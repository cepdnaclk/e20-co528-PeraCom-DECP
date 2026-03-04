import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection } from "mongoose";
import { Project, type ProjectDocument } from "./schemas/project.schema.js";
import {
  ProjectMember,
  MemberRole,
  type ProjectMemberDocument,
} from "../members/schemas/project-member.schema.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus/dist/injector.js";
import type { Counter } from "prom-client";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,

    @InjectModel(ProjectMember.name)
    private readonly memberModel: Model<ProjectMemberDocument>,

    @InjectConnection() private readonly connection: Connection, // ✨ Required for Transactions

    @InjectMetric("collaboration_projects_created_total")
    private projectCreatedCounter: Counter<string>,

    @InjectPinoLogger(ProjectsService.name) private readonly logger: PinoLogger,
  ) {}

  // ========================================================================
  // CREATE PROJECT (Transactional & Atomic)
  // ========================================================================
  async createProject(
    actorId: string,
    correlationId: string,
    dto: CreateProjectDto,
  ) {
    // 1. Initialize the MongoDB Transaction Session
    const session = await this.connection.startSession();

    let savedProject: ProjectDocument = null!;

    try {
      // 2. Start the ACID Transaction
      await session.withTransaction(async () => {
        // Step A: Create the Project
        const newProject = new this.projectModel({
          ...dto,
          createdBy: actorId,
          memberCount: 1, // The creator is member #1
        });

        // Pass the session to the save method
        savedProject = await newProject.save({ session });

        // Step B: Create the OWNER Membership
        const newMember = new this.memberModel({
          projectId: savedProject._id,
          userId: actorId,
          role: MemberRole.OWNER,
        });

        // Pass the session to the save method
        await newMember.save({ session });
      }); // Transaction automatically commits here if no errors are thrown
    } catch (error) {
      // If either Step A or Step B fails, MongoDB drops both completely.
      this.logger.error(
        { error, correlationId, actorId },
        "Failed to create project transactionally",
      );
      throw new InternalServerErrorException(
        "Failed to initialize project space.",
      );
    } finally {
      // 3. Always end the session to prevent memory leaks
      await session.endSession();
    }

    // 4. Observability & Event Emission (Post-Transaction)
    this.projectCreatedCounter.inc({ visibility: savedProject?.visibility });

    const projectCreatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.project.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: savedProject._id.toString(),
        title: savedProject.title,
        visibility: savedProject.visibility,
      },
    };

    // Fire and forget event publishing
    publishEvent("collaboration.events", projectCreatedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, projectId: savedProject._id },
        "Failed to publish project created event",
      ),
    );

    return savedProject;
  }

  // ========================================================================
  // UPDATE PROJECT (With Optimistic Concurrency Control)
  // ========================================================================
  async updateProject(
    actorId: string,
    correlationId: string,
    dto: UpdateProjectDto,
  ) {
    const { projectId, ...payload } = dto;

    // 1. Fetch the project, ensuring it hasn't been soft-deleted
    const project = await this.projectModel
      .findOne({ _id: projectId, isDeleted: false })
      .exec(); // Note: We do NOT use .lean() here because we need the Mongoose Document wrapper for OCC

    if (!project)
      throw new NotFoundException("Project not found or has been deleted");

    // 2. Explicit Version Check (If the frontend provided one)
    if (
      payload.expectedVersion !== undefined &&
      project.__v !== payload.expectedVersion
    ) {
      throw new ConflictException(
        "This project was modified by another user. Please refresh and try again.",
      );
    }

    // 3. Apply changes
    if (payload.title) project.title = payload.title;
    if (payload.description) project.description = payload.description;
    if (payload.visibility) project.visibility = payload.visibility;

    try {
      // 4. Save with Automatic OCC
      // Under the hood, Mongoose runs: update { _id: id, __v: currentVersion } set { ...changes, $inc: { __v: 1 } }
      const updatedProject = await project.save();

      // Emit Domain Event
      const projectUpdatedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "collaboration.project.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          project_id: updatedProject._id.toString(),
          new_version: updatedProject.__v,
        },
      };
      publishEvent("collaboration.events", projectUpdatedEvent).catch(
        this.logger.error.bind(
          this.logger,
          { correlationId, actorId, projectId: updatedProject._id },
          "Failed to publish project updated event",
        ),
      );

      return updatedProject;
    } catch (error: any) {
      // Catch Mongoose's internal VersionError if a race condition happened exactly during save()
      if (error.name === "VersionError") {
        this.logger.warn(
          { correlationId, projectId },
          "OCC Version conflict during project update",
        );
        throw new ConflictException(
          "Data changed concurrently. Please refresh.",
        );
      }
      throw error;
    }
  }
}
