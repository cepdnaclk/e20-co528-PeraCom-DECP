import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Connection, Model } from "mongoose";
import {
  ProjectInvitation,
  InvitationStatus,
  InvitationType,
  type ProjectInvitationDocument,
} from "./schemas/project-invitation.schema.js";
import {
  MemberRole,
  ProjectMember,
  type ProjectMemberDocument,
} from "../members/schemas/project-member.schema.js";
import {
  Project,
  ProjectVisibility,
  type ProjectDocument,
} from "../projects/schemas/project.schema.js";
import {
  CreateInvitationDto,
  RespondInvitationDto,
} from "./dto/invitation.dto.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { env } from "../config/validateEnv.config.js";

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(ProjectInvitation.name)
    private readonly inviteModel: Model<ProjectInvitationDocument>,

    @InjectModel(ProjectMember.name)
    private readonly memberModel: Model<ProjectMemberDocument>,

    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,

    @InjectConnection() private readonly connection: Connection,

    @InjectPinoLogger(InvitationsService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ========================================================================
  // SEND INVITATION
  // ========================================================================
  async createInvitation(
    actorId: string,
    correlationId: string,
    projectId: string,
    dto: CreateInvitationDto,
  ) {
    // 1. Check if they are already a member
    const existingMember = await this.memberModel.exists({
      projectId: new Types.ObjectId(projectId),
      userId: dto.inviteeId,
    });
    if (existingMember)
      throw new ConflictException("User is already a member of this project.");

    const pendingInvite = await this.inviteModel.exists({
      projectId: new Types.ObjectId(projectId),
      inviteeId: dto.inviteeId,
      status: InvitationStatus.PENDING,
    });
    if (pendingInvite)
      throw new ConflictException("A pending invite already exists.");

    // 2. Set Expiration (e.g., 7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.MAX_INVITATION_LIFETIME_DAYS);

    try {
      // 3. Create the Invite
      const invite = new this.inviteModel({
        projectId: new Types.ObjectId(projectId),
        inviterId: actorId,
        inviteeId: dto.inviteeId,
        inviteeEmail: dto.inviteeEmail,
        role: dto.role,
        type: InvitationType.OUTBOUND_INVITE, // From project to user
        status: InvitationStatus.PENDING,
        expiresAt,
      });

      const savedInvite = await invite.save();

      // Emit Event (Notification Service will catch this and send the Email/Push!)
      const inviteEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "collaboration.member.invited",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          invitation_id: savedInvite._id.toString(),
          project_id: projectId,
          invitee_id: dto.inviteeId,
          invitee_email: dto.inviteeEmail,
          role: dto.role,
          invitation_type: invite.type,
        },
      };
      publishEvent("collaboration.events", inviteEvent).catch((err) =>
        this.logger.error(
          { error: err, correlationId, invitationId: savedInvite._id },
          "Failed to publish invitation event",
        ),
      );

      return savedInvite;
    } catch (error: any) {
      // Catch our Unique Index collision if an invite is already pending
      this.logger.error(
        { error, correlationId, projectId, inviteeId: dto.inviteeId },
        "Failed to create invitation",
      );
      if (error.code === 11000) {
        throw new ConflictException(
          "A pending invitation already exists for this user.",
        );
      }
      throw error;
    }
  }

  // ========================================================================
  // RESPOND TO INVITATION (Atomic Transaction: ACCEPTED or DECLINED)
  // ========================================================================
  async respondToInvitation(
    actorId: string,
    correlationId: string,
    dto: RespondInvitationDto,
  ) {
    const { invitationId, action } = dto;

    // 1. Initial Fetch to verify ownership and type
    const invite = await this.inviteModel
      .findOne({
        _id: invitationId,
        type: InvitationType.OUTBOUND_INVITE,
      })
      .exec();
    if (!invite)
      throw new NotFoundException("Invitation not found or has expired");

    // 2. Security check: Only the invitee can respond
    if (invite.inviteeId !== actorId) {
      throw new ForbiddenException(
        "You are not authorized to respond to this invitation.",
      );
    }

    if (invite.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invite.status}`);
    }

    // If DECLINED, just update the status (no transaction needed)
    if (action === "DECLINED") {
      // Use findOneAndUpdate here too for consistency and race-condition safety!
      const declinedInvite = await this.inviteModel.findOneAndUpdate(
        { _id: invitationId, status: InvitationStatus.PENDING },
        { $set: { status: InvitationStatus.DECLINED } },
        { new: true },
      );

      if (!declinedInvite) {
        throw new ConflictException(
          "This invitation has already been processed.",
        );
      }

      return { success: true, message: "Invitation declined." };
    }

    // ✨ THE ACCEPTANCE TRANSACTION ✨
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Step 1: Mark Invite as Accepted
        const updatedInvite = await this.inviteModel.findOneAndUpdate(
          { _id: invitationId, status: InvitationStatus.PENDING },
          { $set: { status: InvitationStatus.ACCEPTED } },
          { session, new: true },
        );

        // If another request beat us to it, this will return null
        if (!updatedInvite) {
          throw new ConflictException(
            "This invitation has already been processed.",
          );
        }

        // Step 2: Create the Membership Record
        const newMember = new this.memberModel({
          projectId: invite.projectId,
          userId: actorId,
          role: invite.role,
        });
        await newMember.save({ session });

        // Step 3: Atomically Increment Project Member Count
        await this.projectModel.updateOne(
          { _id: invite.projectId },
          { $inc: { memberCount: 1 } },
          { session },
        );
      });
    } catch (error) {
      this.logger.error(
        { error, correlationId, invitationId },
        "Failed to process invitation acceptance transaction",
      );

      throw new InternalServerErrorException(
        "Failed to join project. Please try again.",
      );
    } finally {
      await session.endSession();
    }

    // Post-Transaction Event Emission
    const joinedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.member.joined",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: invite.projectId.toString(),
        user_id: actorId,
        role: invite.role,
        invitation_type: invite.type,
      },
    };
    publishEvent("collaboration.events", joinedEvent).catch((err) => {
      this.logger.error(
        { error: err, correlationId, invitationId },
        "Failed to publish joined event",
      );
    });

    return { success: true, message: "Successfully joined the project!" };
  }

  // ========================================================================
  // REVOKE INVITATION (Owner cancels an outbound invite)
  // ========================================================================
  async revokeInvitation(
    actorId: string,
    correlationId: string,
    projectId: string,
    invitationId: string,
  ) {
    if (!Types.ObjectId.isValid(invitationId))
      throw new BadRequestException("Invalid Invitation ID");

    // 1. Fetch the Pending Outbound Invite
    const invitation = await this.inviteModel
      .findOne({
        _id: invitationId,
        projectId: new Types.ObjectId(projectId),
        type: InvitationType.OUTBOUND_INVITE,
      })
      .exec();

    if (!invitation) {
      throw new NotFoundException("Pending invitation not found.");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot revoke. This invitation is already ${invitation.status}.`,
      );
    }

    // 2. Apply Revocation
    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();

    // 3. Emit Domain Event (Notification service can optionally email the user saying the invite was canceled)
    publishEvent("collaboration.events", {
      eventId: uuidv7(),
      eventType: "collaboration.member.invitation_revoked",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        invitation_id: invitationId,
        project_id: projectId,
        invitee_id: invitation.inviteeId,
        invitee_email: invitation.inviteeEmail,
        invitation_type: invitation.type,
      },
    }).catch((err) =>
      this.logger.error(
        { err, correlationId, invitationId },
        "Failed to publish invitation revocation event",
      ),
    );

    return {
      success: true,
      message: "Invitation has been successfully revoked.",
    };
  }

  // ========================================================================
  // REQUEST TO JOIN PROJECT (Inbound Request from User)
  // ========================================================================
  async requestToJoinProject(
    actorId: string,
    correlationId: string,
    projectId: string,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    // 1. Fetch Project & Enforce Visibility
    const project = await this.projectModel
      .findOne({ _id: projectId, isDeleted: false })
      .lean()
      .exec();

    if (!project || project.visibility === ProjectVisibility.PRIVATE) {
      // 🛡️ Zero-Trust: We act like the project doesn't exist if it's private
      throw new NotFoundException("Project not found");
    }

    // 2. Prevent Duplicate Memberships
    const existingMember = await this.memberModel.exists({
      projectId: new Types.ObjectId(projectId),
      userId: actorId,
    });
    if (existingMember)
      throw new ConflictException("You are already a member of this project.");

    // 3. Prevent Spamming Requests
    const existingRequest = await this.inviteModel.exists({
      projectId: new Types.ObjectId(projectId),
      inviteeId: actorId,
      status: InvitationStatus.PENDING,
    });
    if (existingRequest)
      throw new ConflictException(
        "You already have a pending request or invitation for this project.",
      );

    // 4. Create the Inbound Request
    // Expiration set. So the DB auto-cleans ignored requests
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.MAX_INVITATION_LIFETIME_DAYS);

    const joinRequest = new this.inviteModel({
      projectId: project._id,
      inviterId: actorId, // They are initiating the request themselves
      inviteeId: actorId, // They are the target of the membership
      type: InvitationType.INBOUND_REQUEST, // ✨ Crucial distinction
      role: MemberRole.EDITOR, // Hardcoded: Cannot request to be an OWNER
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    const savedRequest = await joinRequest.save();

    // 5. Emit Event (Notification Service will alert the Project Owners)
    const requestEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.join_request.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        request_id: savedRequest._id.toString(),
        project_id: projectId,
        requester_id: actorId,
        project_title: project.title,
        invitation_type: joinRequest.type,
      },
    };
    publishEvent("collaboration.events", requestEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, requestId: savedRequest._id },
        "Failed to publish join request event",
      ),
    );

    return { success: true, message: "Request to join sent successfully." };
  }

  // ========================================================================
  // PROCESS JOIN REQUEST (Owner Approves or Rejects)
  // ========================================================================
  async processJoinRequest(
    actorId: string,
    correlationId: string,
    projectId: string,
    dto: RespondInvitationDto,
  ) {
    const { invitationId, action } = dto;

    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    // 1. Fetch and Validate the Request
    const request = await this.inviteModel
      .findOne({
        _id: invitationId,
        projectId: new Types.ObjectId(projectId),
        type: InvitationType.INBOUND_REQUEST,
      })
      .exec();

    if (!request)
      throw new NotFoundException("Request not found or has expired");
    if (request.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `This request is already ${request.status}`,
      );
    }

    // ==========================================
    // PATH A: REJECT THE REQUEST
    // ==========================================
    if (action === "DECLINED") {
      const declinedInvite = await this.inviteModel.findOneAndUpdate(
        { _id: invitationId, status: InvitationStatus.PENDING },
        { $set: { status: InvitationStatus.DECLINED } },
        { new: true },
      );

      if (!declinedInvite) {
        throw new ConflictException(
          "This invitation has already been processed.",
        );
      }

      // Emit rejection event (so the user knows)
      publishEvent("collaboration.events", {
        eventId: uuidv7(),
        eventType: "collaboration.join_request.rejected",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          request_id: invitationId,
          requester_id: declinedInvite.inviteeId,
          project_id: projectId,
          invitation_type: declinedInvite.type,
        },
      }).catch((err) =>
        this.logger.error(
          { err, correlationId, requestId: invitationId },
          "Failed to publish join request rejection event",
        ),
      );

      return { success: true, message: "Request rejected." };
    }

    // ==========================================
    // PATH B: ACCEPT THE REQUEST (ACID Transaction)
    // ==========================================
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Step 1: Mark Request as Accepted
        const updatedInvite = await this.inviteModel.findOneAndUpdate(
          { _id: invitationId, status: InvitationStatus.PENDING },
          { $set: { status: InvitationStatus.ACCEPTED } },
          { session, new: true },
        );
        if (!updatedInvite) {
          throw new ConflictException(
            "This invitation has already been processed.",
          );
        }

        // Step 2: Create the Membership Record
        const newMember = new this.memberModel({
          projectId: updatedInvite.projectId,
          userId: updatedInvite.inviteeId, // The user who requested access
          role: updatedInvite.role, // EDITOR
        });
        await newMember.save({ session });

        // Step 3: Atomically Increment Project Member Count
        await this.projectModel.updateOne(
          { _id: request.projectId },
          { $inc: { memberCount: 1 } },
          { session },
        );
      });
    } catch (error) {
      this.logger.error(
        { error, correlationId, invitationId },
        "Transaction failed while approving join request",
      );
      throw new InternalServerErrorException(
        "Failed to approve request. Please try again.",
      );
    } finally {
      await session.endSession();
    }

    // 4. Emit the standard "Member Joined" event!
    publishEvent("collaboration.events", {
      eventId: uuidv7(),
      eventType: "collaboration.member.joined",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: projectId,
        user_id: request.inviteeId,
        role: request.role,
        invitationType: request.type,
      },
    }).catch((err) =>
      this.logger.error(
        { err, correlationId, requestId: invitationId },
        "Failed to publish member joined event",
      ),
    );

    return { success: true, message: "User has been added to the project." };
  }

  // ========================================================================
  // REVOKE JOIN REQUEST (User cancels their own inbound request)
  // ========================================================================
  async revokeJoinRequest(
    actorId: string,
    correlationId: string,
    projectId: string,
    requestId: string,
  ) {
    if (!Types.ObjectId.isValid(requestId))
      throw new BadRequestException("Invalid Request ID");

    // 1. Strict Security Boundary:
    // We strictly enforce that the actorId matches the inviteeId (the person who made the request).
    // This prevents malicious users from canceling other people's pending requests.
    const request = await this.inviteModel
      .findOne({
        _id: requestId,
        projectId: new Types.ObjectId(projectId),
        inviteeId: actorId,
        type: InvitationType.INBOUND_REQUEST,
      })
      .exec();

    if (!request) {
      throw new NotFoundException("Pending request not found.");
    }

    if (request.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot revoke. This request is already ${request.status}.`,
      );
    }

    // 2. Apply Revocation
    request.status = InvitationStatus.REVOKED;
    await request.save();

    // 3. Emit Domain Event
    publishEvent("collaboration.events", {
      eventId: uuidv7(),
      eventType: "collaboration.join_request.revoked",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        request_id: requestId,
        project_id: projectId,
        requester_id: actorId,
        invitationType: request.type,
      },
    }).catch((err) =>
      this.logger.error(
        { err, correlationId, requestId },
        "Failed to publish join request revocation event",
      ),
    );

    return {
      success: true,
      message: "Your request to join has been withdrawn.",
    };
  }

  // ========================================================================
  // GET UI TAB STATS (Badge Counts for Members, Invites, Requests)
  // ========================================================================
  async getProjectTabStats(
    actorId: string,
    correlationId: string,
    projectId: string,
  ) {
    if (!Types.ObjectId.isValid(projectId))
      throw new BadRequestException("Invalid Project ID");

    // Run all three lightweight queries in parallel for maximum speed
    const [project, pendingInvitesCount, pendingRequestsCount] =
      await Promise.all([
        this.projectModel
          .findById(projectId)
          .select("memberCount")
          .lean()
          .exec(),
        this.inviteModel
          .countDocuments({
            projectId: new Types.ObjectId(projectId),
            type: InvitationType.OUTBOUND_INVITE,
            status: InvitationStatus.PENDING,
          })
          .exec(),
        this.inviteModel
          .countDocuments({
            projectId: new Types.ObjectId(projectId),
            type: InvitationType.INBOUND_REQUEST,
            status: InvitationStatus.PENDING,
          })
          .exec(),
      ]);

    if (!project) throw new NotFoundException("Project not found");

    // Kafka Event
    const statsEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.project.tab_stats_viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        project_id: projectId,
        members_count: project.memberCount,
        invitations_count: pendingInvitesCount,
        requests_count: pendingRequestsCount,
      },
    };

    publishEvent("collaboration.events", statsEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, projectId },
        "Failed to publish project tab stats viewed event",
      ),
    );

    return {
      membersCount: project.memberCount,
      invitationsCount: pendingInvitesCount,
      requestsCount: pendingRequestsCount,
    };
  }

  // ========================================================================
  // LIST 1: GET PENDING OUTBOUND INVITATIONS
  // ========================================================================
  async getPendingInvitations(projectId: string, limit = 20, skip = 0) {
    const invitations = await this.inviteModel
      .find({
        projectId: new Types.ObjectId(projectId),
        type: InvitationType.OUTBOUND_INVITE,
        status: InvitationStatus.PENDING,
      })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return invitations.map((inv) => ({
      id: inv._id,
      inviteeId: inv.inviteeId,
      inviteeEmail: inv.inviteeEmail,
      role: inv.role,
      invitedAt: inv.createdAt,
      remainingDays: Math.ceil(
        (inv.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  // ========================================================================
  // LIST 2: GET PENDING INBOUND JOIN REQUESTS
  // ========================================================================
  async getPendingJoinRequests(projectId: string, limit = 20, skip = 0) {
    const requests = await this.inviteModel
      .find({
        projectId: new Types.ObjectId(projectId),
        type: InvitationType.INBOUND_REQUEST,
        status: InvitationStatus.PENDING,
      })
      .sort({ createdAt: 1 }) // Oldest first (FIFO queue for processing requests)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return requests.map((req) => ({
      id: req._id,
      requesterId: req.inviteeId, // The person who wants to join
      requestedRole: req.role,
      requestedAt: req.createdAt,
      remainingDays: Math.ceil(
        (req.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }
}
