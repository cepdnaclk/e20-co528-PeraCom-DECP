import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { v7 as uuidv7 } from "uuid";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
} from "./dto/social-media.dto.js";

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // CREATE SOCIAL MEDIA LINK
  // ==========================================
  async createSocialLink(
    userId: string,
    correlationId: string,
    payload: CreateSocialLinkDto,
  ) {
    // 1. Prevent duplicate — same user + same platform + same URL
    const existingLink = await this.prisma.socialLink.findFirst({
      where: {
        user_id: userId,
        platform: payload.platform,
        url: payload.url.trim(),
      },
    });
    if (existingLink) {
      throw new ConflictException(
        `A ${payload.platform} link with the same URL already exists for this user`,
      );
    }

    // 3. Create the new social link record in the database
    const newLink = await this.prisma.socialLink.create({
      data: {
        id: uuidv7(),
        user_id: userId,
        platform: payload.platform,
        url: payload.url.trim(),
      },
    });

    // 4. Emit Kafka event so other services stay in sync
    try {
      const createdSocialEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.social_link.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: newLink.id,
          user_id: userId,
          platform: newLink.platform,
        },
      };
      await publishEvent("identity.events", createdSocialEvent);
    } catch (error) {
      // Log the error but do NOT roll back — the record was saved successfully
      console.error("Failed to publish social_link.created event:", error);
    }

    // 8. Return success response with the newly created link
    return { status: "social_link_created", socialLink: newLink };
  }

  // ==========================================
  // UPDATE SOCIAL MEDIA LINK
  // ==========================================
  async updateSocialLink(
    userId: string,
    correlationId: string,
    payload: UpdateSocialLinkDto,
  ) {
    // 1. Extract linkId and updateData from payload
    const { id, ...data } = payload;

    // 2. Prevent duplicate (same user, platform, url, but different id)
    const duplicate = await this.prisma.socialLink.findFirst({
      where: {
        user_id: userId,
        platform: payload.platform,
        url: data.url.trim(),
        NOT: { id },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        `A ${payload.platform} link with the same URL already exists for this user`,
      );
    }

    // 4. Update the social link
    const updatedLink = await this.prisma.socialLink.update({
      where: { id, user_id: userId },
      data: {
        platform: payload.platform,
        url: data.url.trim(),
      },
    });

    // 5. If no record was found to update, throw NotFound
    if (!updatedLink) {
      throw new NotFoundException("Social media link not found");
    }

    // 6. Emit Kafka event for update
    try {
      const updatedSocialEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.social_link.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: updatedLink.id,
          user_id: userId,
          platform: updatedLink.platform,
        },
      };
      await publishEvent("identity.events", updatedSocialEvent);
    } catch (error) {
      console.error("Failed to publish social_link.updated event:", error);
    }

    // 8. Return updated link
    return { status: "social_link_updated", socialLink: updatedLink };
  }

  // ==========================================
  // DELETE SOCIAL MEDIA LINK
  // ==========================================
  async deleteSocialLink(
    userId: string,
    correlationId: string,
    linkId: string,
  ) {
    // 1. Validate linkId
    if (!linkId || linkId.trim().length === 0) {
      throw new BadRequestException("Social link ID is required");
    }

    // 2. Delete the social link owned by the user
    const deletedLink = await this.prisma.socialLink.delete({
      where: { id: linkId, user_id: userId },
    });

    // 3. If no record was found to delete, throw NotFound
    if (!deletedLink) {
      throw new NotFoundException("Social media link not found");
    }

    // 4. Emit Kafka event for deletion
    try {
      const deletedSocialEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "identity.social_link.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          id: deletedLink.id,
          user_id: userId,
          platform: deletedLink.platform,
        },
      };
      await publishEvent("identity.events", deletedSocialEvent);
    } catch (error) {
      console.error("Failed to publish social_link.deleted event:", error);
    }

    // 5. Return success response
    return { status: "social_link_deleted", id: deletedLink.id };
  }

  // ==========================================
  // VIEW ALL SOCIAL MEDIA LINKS FOR USER
  // ==========================================
  async viewSocialLinks(userId: string, correlationId: string) {
    // 1. Fetch all social links for the user, ordered by creation date (newest first)
    const links = await this.prisma.socialLink.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // 2. Create kafka event for viewing social links (for logging/analytics purposes)
    const viewSocialLinksEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.social_links.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: userId,
      data: {
        user_id: userId,
        count: links.length,
      },
    };
    try {
      await publishEvent("identity.events", viewSocialLinksEvent);
    } catch (error) {
      console.error("Failed to publish social_links.viewed event:", error);
    }

    return { status: "ok", socialLinks: links };
  }
}
