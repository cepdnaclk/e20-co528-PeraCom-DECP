import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Connection, Model } from "mongoose";
import {
  Project,
  ProjectVisibility,
  type ProjectDocument,
} from "./schemas/project.schema.js";
import {
  ProjectMember,
  MemberRole,
  type ProjectMemberDocument,
} from "../members/schemas/project-member.schema.js";
import {
  ProjectInvitation,
  InvitationStatus,
  type ProjectInvitationDocument,
} from "../invitations/schemas/project-invitation.schema.js";
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

    @InjectModel(ProjectInvitation.name)
    private readonly inviteModel: Model<ProjectInvitationDocument>,

    @InjectConnection() private readonly connection: Connection,

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
    this.projectCreatedCounter.inc({ visibility: savedProject.visibility });

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
    projectId: string,
    payload: UpdateProjectDto,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid project ID");

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

  // ========================================================================
  // REMOVE PROJECT (Soft Delete)
  // ========================================================================
  async removeProject(
    actorId: string,
    correlationId: string,
    projectId: string,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid project ID");

    const project = await this.projectModel
      .findOne({ _id: projectId, isDeleted: false })
      .exec();

    if (!project) throw new NotFoundException("Project not found");

    // Apply Soft Delete & Archive Status
    project.isDeleted = true;
    project.deletedAt = new Date();

    try {
      const deletedProject = await project.save();

      const projectDeletedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "collaboration.project.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          project_id: deletedProject._id.toString(),
          title: deletedProject.title,
        },
      };

      publishEvent("collaboration.events", projectDeletedEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, actorId, projectId: deletedProject._id },
          "Failed to publish project deleted event",
        ),
      );

      return { success: true, message: "Project successfully deleted" };
    } catch (error: any) {
      if (error.name === "VersionError") {
        throw new ConflictException(
          "Failed to delete due to concurrent modifications. Try again.",
        );
      }
      throw error;
    }
  }

  // ========================================================================
  // GET PROJECTS FEED (The Public View | Internal View)
  // ========================================================================
  async getProjectsFeed(
    visibility: ProjectVisibility[],
    cursor?: string, // ISO Date string of the last seen project's createdAt
    cursorId?: string, // The _id of the last seen project
    limit?: number,
    search?: string,
  ) {
    // 1. Enforce Safe Limits to prevent DB DoS attacks
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    // 2. 🛡️ The Hardcoded Security Boundary
    // NEVER allow PRIVATE projects to surface here.
    const filter: any = {
      isDeleted: false,
      visibility: { $in: visibility },
    };

    // 3. Apply Text Search (Utilizes the $text index we created)
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    // 4. Apply the Chronological Cursor (Sorting Newest First)
    if (cursor && cursorId) {
      if (!Types.ObjectId.isValid(cursorId)) {
        throw new BadRequestException("Invalid cursorId format");
      }

      const cursorDate = new Date(cursor);

      // We want projects created *before* the last seen project (going back in time)
      // Or created at the exact same millisecond, but with a smaller _id (tiebreaker)
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        {
          createdAt: cursorDate,
          _id: { $lt: new Types.ObjectId(cursorId) },
        },
      ];
    } else if (cursor || cursorId) {
      throw new BadRequestException(
        "Both cursor and cursorId are required for pagination",
      );
    }

    // 5. Execute Query with Limit + 1
    const projects = await this.projectModel
      .find(filter)
      // When using $text search, sorting by textScore is usually better,
      // but for a standard chronological feed, we sort by Date DESC, then ID DESC.
      .sort(
        search ? { score: { $meta: "textScore" } } : { createdAt: -1, _id: -1 },
      )
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 6. Resolve Next Cursor
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;

    if (projects.length > safeLimit) {
      const extraProject = projects.pop(); // Remove the +1 lookahead item

      const lastProject = projects[projects.length - 1];
      nextCursor = lastProject?.createdAt.toISOString() || null;
      nextCursorId = lastProject?._id.toString() || null;
    }

    // 7. Sanitize Output Data (Prevent leaking internal __v or exact deletedAt fields)
    const sanitizedProjects = projects.map((p) => ({
      id: p._id,
      title: p.title,
      description: p.description,
      visibility: p.visibility,
      memberCount: p.memberCount,
      documentCount: p.documentCount,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    }));

    return {
      data: sanitizedProjects,
      nextCursor,
      nextCursorId,
      meta: {
        appliedSearch: search || null,
        count: sanitizedProjects.length,
      },
    };
  }

  // ========================================================================
  // GET PROJECTS FEED (The Private View)
  // ========================================================================
  async getMyProjectsFeed(
    actorId: string,
    cursor?: string, // ISO Date string of the last seen project's createdAt
    cursorId?: string, // The _id of the last seen project
    limit?: number,
    search?: string,
  ) {
    // 1. Enforce Safe Limits to prevent DB DoS attacks
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    // 2. Resolve all projects where this actor is a contributor/member
    const contributedProjectIds = await this.memberModel.distinct("projectId", {
      userId: actorId,
    });

    if (contributedProjectIds.length === 0) {
      return {
        data: [],
        nextCursor: null,
        nextCursorId: null,
        meta: {
          appliedSearch: search || null,
          count: 0,
        },
      };
    }

    // 3. Build filter for projects contributed by the actor only
    const filter: any = {
      isDeleted: false,
      _id: { $in: contributedProjectIds },
    };

    // 4. Apply Text Search (Utilizes the $text index we created)
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    // 5. Apply the Chronological Cursor (Sorting Newest First)
    if (cursor && cursorId) {
      if (!Types.ObjectId.isValid(cursorId)) {
        throw new BadRequestException("Invalid cursorId format");
      }

      const cursorDate = new Date(cursor);

      // We want projects created *before* the last seen project (going back in time)
      // Or created at the exact same millisecond, but with a smaller _id (tiebreaker)
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        {
          createdAt: cursorDate,
          _id: { $lt: new Types.ObjectId(cursorId) },
        },
      ];
    } else if (cursor || cursorId) {
      throw new BadRequestException(
        "Both cursor and cursorId are required for pagination",
      );
    }

    // 6. Execute Query with Limit + 1
    const projects = await this.projectModel
      .find(filter)
      // When using $text search, sorting by textScore is usually better,
      // but for a standard chronological feed, we sort by Date DESC, then ID DESC.
      .sort(
        search ? { score: { $meta: "textScore" } } : { createdAt: -1, _id: -1 },
      )
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 7. Resolve Next Cursor
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;

    if (projects.length > safeLimit) {
      const extraProject = projects.pop(); // Remove the +1 lookahead item

      const lastProject = projects[projects.length - 1];
      nextCursor = lastProject?.createdAt.toISOString() || null;
      nextCursorId = lastProject?._id.toString() || null;
    }

    // 8. Sanitize Output Data (Prevent leaking internal __v or exact deletedAt fields)
    const sanitizedProjects = projects.map((p) => ({
      id: p._id,
      title: p.title,
      description: p.description,
      visibility: p.visibility,
      memberCount: p.memberCount,
      documentCount: p.documentCount,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    }));

    return {
      data: sanitizedProjects,
      nextCursor,
      nextCursorId,
      meta: {
        appliedSearch: search || null,
        count: sanitizedProjects.length,
      },
    };
  }

  // ========================================================================
  // GET PROJECT BY ID (With strict visibility & role resolution)
  // ========================================================================
  async getProjectById(
    actorId: string,
    correlationId: string,
    projectId: string,
    visibility?: ProjectVisibility,
  ) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException("Invalid project ID format");
    }

    // 1. Fetch the project (Must not be soft-deleted)
    const filter: any = {
      _id: projectId,
      isDeleted: false,
    };
    if (visibility && visibility === ProjectVisibility.PUBLIC) {
      filter.visibility = ProjectVisibility.PUBLIC;
    }
    const project = await this.projectModel.findOne(filter).lean().exec();

    if (!project) throw new NotFoundException("Project not found");

    // 2. Resolve the Actor's Membership Status
    // We need to know if the person making the request is actually in the project.
    const memberRecord = await this.memberModel
      .findOne({
        projectId: new Types.ObjectId(projectId),
        userId: actorId,
      })
      .lean()
      .exec();

    // 3. 🛡️ The Zero-Trust Security Boundary
    if (!memberRecord && project.visibility === ProjectVisibility.PRIVATE) {
      // The user is not a member, and the project is PRIVATE.
      // We throw a 404 to completely hide its existence from unauthorized users.
      throw new NotFoundException("Project not found");
    }

    // 4. Invitation Status Check
    const pendingInvite = await this.inviteModel
      .findOne({
        projectId: new Types.ObjectId(projectId),
        inviteeId: actorId,
        status: InvitationStatus.PENDING,
      })
      .select("_id type")
      .lean()
      .exec();

    // 5. Calculate the specific role string for the frontend
    let computedRole: string | null = null;
    if (memberRecord) {
      computedRole = memberRecord.role;
    } else if (pendingInvite) {
      computedRole = `PENDING_${pendingInvite.type}`;
    }

    // 6. Kafka Event Emission (Project Viewed)
    const projectViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.project.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: project._id.toString(),
        visibility: project.visibility,
        isMember: !!memberRecord,
        memberRole: memberRecord ? memberRecord.role : null,
        computedRole,
      },
    };
    publishEvent("collaboration.events", projectViewedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, projectId },
        "Failed to publish project viewed event",
      ),
    );

    // 7. Sanitize and Shape the Output
    return {
      id: project._id,
      title: project.title,
      description: project.description,
      visibility: project.visibility,
      memberCount: project.memberCount,
      documentCount: project.documentCount,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,

      // ✨ Frontend Context: Crucial for UI rendering!
      // If myRole is null, the frontend knows to show a "Join Project" button.
      // If myRole is 'OWNER', the frontend knows to show the "Settings" and "Delete" buttons.
      // If myRole is 'PENDING_...', it knows to show a "Request Pending" state.
      myRole: computedRole,
    };
  }
}
