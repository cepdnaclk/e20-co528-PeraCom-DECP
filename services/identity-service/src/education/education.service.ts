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
  NewEducationDto,
  UpdateEducationDto,
} from "./dto/education.dto.js";

@Injectable()
export class EducationService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // VIEW ALL EDUCATION FOR USER
  // ==========================================
  async viewEducation(userId: string, correlationId: string) {
    // 1. Fetch all education for the user, ordered by creation date (newest first)
    const educations = await this.prisma.education.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // 2. Emit event for viewing education
    try {
      const viewedEducationEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.education.viewed",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          user_id: userId,
          count: educations.length,
        },
      };
      await publishEvent("identity.events", viewedEducationEvent);
    } catch (error) {
      console.error("Failed to publish education.viewed event:", error);
    }

    // 3. Return education records
    return { status: "ok", educations };
  }

  // ==========================================
  // CREATE EDUCATION
  // ==========================================
  async createEducation(
    userId: string,
    correlationId: string,
    payload: NewEducationDto,
  ) {
    // 1. Prevent duplicate (same user, same institution, same degree, same start_date)
    const existing = await this.prisma.education.findFirst({
      where: {
        user_id: userId,
        institution: payload.institution.trim(),
        degree: payload.degree?.trim() ?? null,
        start_date: payload.start_date ?? null,
      },
    });
    if (existing) {
      throw new ConflictException(
        "An education record with the same institution, degree, and start date already exists for this user",
      );
    }

    // 2. Create the education record
    const newEducation = await this.prisma.education.create({
      data: {
        id: uuidv7(),
        user_id: userId,
        institution: payload.institution.trim(),
        degree: payload.degree?.trim() ?? null,
        field_of_study: payload.field_of_study?.trim() ?? null,
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        grade: payload.grade?.trim() ?? null,
      },
    });
    if (!newEducation) {
      throw new BadRequestException("Failed to create education record");
    }

    // 3. Emit event for created education
    try {
      const createdEducationEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.education.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: newEducation.id,
          user_id: userId,
          institution: newEducation.institution,
        },
      };
      await publishEvent("identity.events", createdEducationEvent);
    } catch (error) {
      console.error("Failed to publish education.created event:", error);
    }

    // 4. Return success response
    return { status: "education_created", education: newEducation };
  }

  // ==========================================
  // UPDATE EDUCATION
  // ==========================================
  async updateEducation(
    userId: string,
    correlationId: string,
    payload: UpdateEducationDto,
  ) {
    // 1. Extract educationId and updateData from payload
    const { id, ...data } = payload;

    // 2. Validate education record exists and belongs to user
    const education = await this.prisma.education.findUnique({
      where: { id },
    });
    if (!education) {
      throw new NotFoundException("Education record not found");
    }
    if (education.user_id !== userId) {
      throw new ConflictException("You do not own this education record");
    }

    // 3. If institution, degree, or start_date is being updated, check for duplicates
    if (data.institution || data.degree || data.start_date) {
      const duplicate = await this.prisma.education.findFirst({
        where: {
          user_id: userId,
          institution: data.institution || education.institution,
          degree: data.degree ?? education.degree,
          start_date: data.start_date ?? education.start_date,
          NOT: { id: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          "An education record with the same institution, degree, and start date already exists for this user",
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

    // 5. Update the education record
    const updatedEducation = await this.prisma.education.update({
      where: { id, user_id: userId },
      data: updateData,
    });

    // 6. If no record was found to update, throw NotFound
    if (!updatedEducation) {
      throw new NotFoundException("Education record not found");
    }

    // 7. Emit event for updated education
    try {
      const updatedEducationEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.education.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: updatedEducation.id,
          user_id: userId,
          institution: updatedEducation.institution,
        },
      };
      await publishEvent("identity.events", updatedEducationEvent);
    } catch (error) {
      console.error("Failed to publish education.updated event:", error);
    }

    // 8. Return updated education
    return { status: "education_updated", education: updatedEducation };
  }

  // ==========================================
  // DELETE EDUCATION
  // ==========================================
  async deleteEducation(
    userId: string,
    correlationId: string,
    educationId: string,
  ) {
    // 1. Validate education record exists
    if (!educationId) {
      throw new NotFoundException("Education ID is required");
    }

    // 2. Delete the education record if it belongs to the user
    const education = await this.prisma.education.delete({
      where: { id: educationId, user_id: userId },
    });

    // 3. If no record was found to delete, throw NotFound
    if (!education) {
      throw new NotFoundException("Education record not found");
    }

    // 4. Emit event for deleted education
    try {
      const deletedEducationEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.education.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: education.id,
          user_id: userId,
        },
      };
      await publishEvent("identity.events", deletedEducationEvent);
    } catch (error) {
      console.error("Failed to publish education.deleted event:", error);
    }

    // 5. Return success response
    return { status: "education_deleted", id: education.id };
  }
}
