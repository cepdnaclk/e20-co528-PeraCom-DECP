import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Connection, Model } from "mongoose";
import {
  ProjectMember,
  MemberRole,
  type ProjectMemberDocument,
} from "./schemas/project-member.schema.js";
import {
  Project,
  type ProjectDocument,
} from "../projects/schemas/project.schema.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { ProjectsService } from "../projects/projects.service.js";
import type { UpdateMemberDto } from "./dto/update-member.dto.js";

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(ProjectMember.name)
    private readonly memberModel: Model<ProjectMemberDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectPinoLogger(ProjectsService.name) private readonly logger: PinoLogger,
  ) {}

  // ========================================================================
  // GET ALL MEMBERS
  // ========================================================================
  async getProjectMembers(
    actorId: string,
    correlationId: string,
    projectId: string,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    // Fetch all members.
    // The frontend will take these userIds and ask the Identity Service for their names and avatars.
    const members = await this.memberModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ joinedAt: 1, _id: 1 }) // Oldest members (usually founders) first
      .lean()
      .exec();

    // Kafka Event for Analytics
    const memberViewEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.members.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: projectId,
        member_count: members.length,
      },
    };

    publishEvent("collaboration.events", memberViewEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, projectId },
        "Failed to publish members.viewed event",
      );
    });

    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  // ========================================================================
  // UPDATE MEMBER ROLE
  // ========================================================================
  async updateMemberRole(
    actorId: string,
    correlationId: string,
    projectId: string,
    dto: UpdateMemberDto,
  ) {
    const { targetUserId, newRole } = dto;

    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    const targetMember = await this.memberModel
      .findOne({
        projectId: new Types.ObjectId(projectId),
        userId: targetUserId,
      })
      .exec();

    if (!targetMember)
      throw new NotFoundException("User is not a member of this project.");
    if (targetMember.role === newRole)
      return { success: true, message: "Role is already set." };

    // 🛡️ THE "GHOST SHIP" PREVENTION
    // If the target is an OWNER, and we are downgrading them, we must ensure they aren't the LAST owner.
    if (
      targetMember.role === MemberRole.OWNER &&
      newRole !== MemberRole.OWNER
    ) {
      const ownerCount = await this.memberModel.countDocuments({
        projectId: new Types.ObjectId(projectId),
        role: MemberRole.OWNER,
      });

      if (ownerCount <= 1) {
        throw new ConflictException(
          "Cannot downgrade the last owner. Transfer ownership to someone else first.",
        );
      }
    }

    const oldRole = targetMember.role;
    targetMember.role = newRole;
    await targetMember.save();

    // Emit Domain Event
    const roleUpdateEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.member.role_updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: projectId,
        target_user_id: targetUserId,
        old_role: oldRole,
        new_role: newRole,
        updated_by: actorId,
      },
    };

    publishEvent("collaboration.events", roleUpdateEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, projectId },
        "Failed to publish member.role_updated event",
      );
    });

    return { success: true, message: "Role updated successfully." };
  }

  // ========================================================================
  // REMOVE MEMBER (Kick or Leave - Transactional)
  // ========================================================================
  async removeMember(
    actorId: string,
    correlationId: string,
    projectId: string,
    targetUserId: string,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    // Find the target membership record
    const targetMember = await this.memberModel
      .findOne({
        projectId: new Types.ObjectId(projectId),
        userId: targetUserId,
      })
      .exec();

    if (!targetMember)
      throw new NotFoundException("User is not a member of this project.");

    // 🛡️ THE "GHOST SHIP" PREVENTION
    if (targetMember.role === MemberRole.OWNER) {
      const ownerCount = await this.memberModel.countDocuments({
        projectId: new Types.ObjectId(projectId),
        role: MemberRole.OWNER,
      });

      if (ownerCount <= 1) {
        throw new ConflictException(
          "The last owner cannot leave. Delete the project or promote someone else to Owner first.",
        );
      }
    }

    // ✨ ACID TRANSACTION: Remove Member & Decrement Count
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Step 1: Delete the membership record
        await this.memberModel.deleteOne(
          { _id: targetMember._id },
          { session },
        );

        // Step 2: Decrement the project's member count
        await this.projectModel.updateOne(
          { _id: targetMember.projectId },
          { $inc: { memberCount: -1 } },
          { session },
        );
      });
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to remove member due to a system error.",
      );
    } finally {
      await session.endSession();
    }

    // Determine if this was a "Kick" or a "Leave" for the event payload
    const actionType = actorId === targetUserId ? "left" : "kicked";

    // Emit Domain Event
    const memberRemovalEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.member.removed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: projectId,
        removed_user_id: targetUserId,
        removed_by: actorId,
        action: actionType,
      },
    };

    publishEvent("collaboration.events", memberRemovalEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, projectId },
        "Failed to publish member.removed event",
      );
    });

    return { success: true, message: `User successfully ${actionType}.` };
  }
}
