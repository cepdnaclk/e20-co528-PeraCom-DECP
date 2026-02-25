import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { v7 as uuidv7 } from "uuid";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import type { NewProjectDto, UpdateProjectDto } from "./dto/projects.dto.js";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // VIEW ALL PROJECTS FOR USER
  // ==========================================
  async viewProjects(userId: string, correlationId: string) {
    // 1. Fetch all projects for the user, ordered by creation date (newest first)
    const projects = await this.prisma.project.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // 2. Emit event for viewing projects
    try {
      const viewedProjectsEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.projects.viewed",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          user_id: userId,
          count: projects.length,
        },
      };
      await publishEvent("identity.events", viewedProjectsEvent);
    } catch (error) {
      console.error("Failed to publish projects.viewed event:", error);
    }

    // 3. Return projects
    return { status: "ok", projects };
  }

  // ==========================================
  // CREATE PROJECT
  // ==========================================
  async createProject(
    userId: string,
    correlationId: string,
    payload: NewProjectDto,
  ) {
    // 1. Prevent duplicate (same user, same title, same start_date)
    const existing = await this.prisma.project.findFirst({
      where: {
        user_id: userId,
        title: payload.title.trim(),
        start_date: payload.start_date,
      },
    });
    if (existing) {
      throw new ConflictException(
        "A project with the same title and start date already exists for this user",
      );
    }

    // 2. Create the project
    const newProject = await this.prisma.project.create({
      data: {
        id: uuidv7(),
        user_id: userId,
        title: payload.title.trim(),
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        description: payload.description ?? null,
        link: payload.link?.trim() ?? null,
      },
    });

    // 3. Return success response
    if (!newProject) {
      throw new BadRequestException("Failed to create project");
    }

    // 4. Emit event
    try {
      const createdProjectEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.project.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: newProject.id,
          user_id: userId,
          title: newProject.title,
        },
      };
      await publishEvent("identity.events", createdProjectEvent);
    } catch (error) {
      console.error("Failed to publish project.created event:", error);
    }
    return { status: "project_created", project: newProject };
  }

  // ==========================================
  // DELETE PROJECT
  // ==========================================
  async deleteProject(
    userId: string,
    correlationId: string,
    projectId: string,
  ) {
    // 1. Validate project exists and belongs to user
    if (!projectId) {
      throw new BadRequestException("Project ID is required");
    }

    // 2. Delete the project
    const deletedProject = await this.prisma.project.delete({
      where: { id: projectId, user_id: userId },
    });

    // 3. If no record was found to delete, throw NotFound
    if (!deletedProject) {
      throw new NotFoundException("Project not found");
    }

    // 4. Emit event for deletion
    try {
      const deletedProjectEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.project.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: deletedProject.id,
          user_id: userId,
        },
      };
      await publishEvent("identity.events", deletedProjectEvent);
    } catch (error) {
      console.error("Failed to publish project.deleted event:", error);
    }
    return { status: "project_deleted", id: deletedProject.id };
  }

  // ==========================================
  // UPDATE PROJECT
  // ==========================================
  async updateProject(
    userId: string,
    correlationId: string,
    payload: UpdateProjectDto,
  ) {
    // 1. Extract projectId and updateData from payload
    const { id, ...data } = payload;

    // 2. Validate project belongs to user
    const project = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    if (project.user_id !== userId) {
      throw new ConflictException("You do not own this project");
    }

    // 3. Prevent duplicate if title/start_date is being changed
    if (data.title || data.start_date) {
      const duplicate = await this.prisma.project.findFirst({
        where: {
          user_id: userId,
          title: data.title || project.title,
          start_date: data.start_date || project.start_date,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          "A project with the same title and start date already exists for this user",
        );
      }
    }

    // 4. Create update data object with trimmed strings
    const updateData: Record<string, any> = { ...data };
    for (const key in updateData) {
      if (
        typeof updateData[key] === "string" &&
        updateData[key].trim() !== "id"
      ) {
        updateData[key] = updateData[key].trim();
      }
    }

    // 5. Update the project
    const updatedProject = await this.prisma.project.update({
      where: { id, user_id: userId },
      data: updateData,
    });

    // 6. If no record was found to update, throw NotFound
    if (!updatedProject) {
      throw new NotFoundException("Project not found");
    }

    // 7. Emit event for update
    try {
      const updatedProjectEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.project.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: updatedProject.id,
          user_id: userId,
          title: updatedProject.title,
        },
      };
      await publishEvent("identity.events", updatedProjectEvent);
    } catch (error) {
      console.error("Failed to publish project.updated event:", error);
    }

    // 8. Return updated project
    return { status: "project_updated", project: updatedProject };
  }
}
