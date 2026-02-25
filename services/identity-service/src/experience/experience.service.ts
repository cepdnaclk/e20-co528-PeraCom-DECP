import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { v7 as uuidv7 } from "uuid";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import type {
  NewExperienceDto,
  UpdateExperienceDto,
} from "./dto/experience.dto.js";

@Injectable()
export class ExperienceService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // VIEW ALL EXPERIENCE FOR USER
  // ==========================================
  async viewExperience(userId: string, correlationId: string) {
    // 1. Fetch all experience for the user, ordered by creation date (newest first)
    const experiences = await this.prisma.experience.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // 2. Emit event for viewing experience
    try {
      const viewedExperienceEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.experience.viewed",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          user_id: userId,
          count: experiences.length,
        },
      };
      await publishEvent("identity.events", viewedExperienceEvent);
    } catch (error) {
      console.error("Failed to publish experience.viewed event:", error);
    }
    return { status: "ok", experiences };
  }

  // ==========================================
  // CREATE EXPERIENCE
  // ==========================================
  async createExperience(
    userId: string,
    correlationId: string,
    payload: NewExperienceDto,
  ) {
    const existing = await this.prisma.experience.findFirst({
      where: {
        user_id: userId,
        title: payload.title.trim(),
        company: payload.company.trim(),
        start_date: payload.start_date,
      },
    });
    if (existing) {
      throw new ConflictException(
        "An experience with the same title, company, and start date already exists for this user",
      );
    }
    const newExperience = await this.prisma.experience.create({
      data: {
        id: uuidv7(),
        user_id: userId,
        title: payload.title.trim(),
        emp_type: payload.emp_type,
        company: payload.company.trim(),
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        location: payload.location?.trim() ?? null,
        description: payload.description ?? null,
      },
    });
    if (!newExperience) {
      throw new BadRequestException("Failed to create experience");
    }
    try {
      const createdExperienceEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.experience.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: newExperience.id,
          user_id: userId,
          title: newExperience.title,
        },
      };
      await publishEvent("identity.events", createdExperienceEvent);
    } catch (error) {
      console.error("Failed to publish experience.created event:", error);
    }
    return { status: "experience_created", experience: newExperience };
  }

  // ==========================================
  // UPDATE EXPERIENCE
  // ==========================================
  async updateExperience(
    userId: string,
    correlationId: string,
    payload: UpdateExperienceDto,
  ) {
    const experience = await this.prisma.experience.findUnique({
      where: { id: payload.id },
    });
    if (!experience) {
      throw new NotFoundException("Experience not found");
    }
    if (experience.user_id !== userId) {
      throw new ConflictException("You do not own this experience");
    }
    if (payload.title || payload.company || payload.start_date) {
      const duplicate = await this.prisma.experience.findFirst({
        where: {
          user_id: userId,
          title: payload.title || experience.title,
          company: payload.company || experience.company,
          start_date: payload.start_date || experience.start_date,
          NOT: { id: payload.id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          "An experience with the same title, company, and start date already exists for this user",
        );
      }
    }
    const updatedExperience = await this.prisma.experience.update({
      where: { id: payload.id },
      data: {
        title: payload.title || experience.title,
        emp_type: payload.emp_type || experience.emp_type,
        company: payload.company || experience.company,
        start_date: payload.start_date || experience.start_date,
        end_date: payload.end_date ?? experience.end_date,
        location: payload.location ?? experience.location,
        description: payload.description ?? experience.description,
      },
    });
    try {
      const updatedExperienceEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.experience.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: updatedExperience.id,
          user_id: userId,
          title: updatedExperience.title,
        },
      };
      await publishEvent("identity.events", updatedExperienceEvent);
    } catch (error) {
      console.error("Failed to publish experience.updated event:", error);
    }
    return { status: "experience_updated", experience: updatedExperience };
  }

  // ==========================================
  // DELETE EXPERIENCE
  // ==========================================
  async deleteExperience(
    userId: string,
    correlationId: string,
    experienceId: string,
  ) {
    // 1. Validate experienceId
    if (!experienceId) {
      throw new NotFoundException("Experience ID not provided");
    }

    // 2. Delete the experience if it belongs to the user
    const deletedExperience = await this.prisma.experience.delete({
      where: { id: experienceId, user_id: userId },
    });

    // 3. If no record was found to delete, Prisma will throw an error which we can catch and convert to NotFound
    if (!deletedExperience) {
      throw new NotFoundException("Experience not found");
    }

    // 4. Emit event for experience deletion
    try {
      const deletedExperienceEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.experience.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: experienceId,
          user_id: userId,
        },
      };
      await publishEvent("identity.events", deletedExperienceEvent);
    } catch (error) {
      console.error("Failed to publish experience.deleted event:", error);
    }
    return { status: "experience_deleted", id: experienceId };
  }
}
