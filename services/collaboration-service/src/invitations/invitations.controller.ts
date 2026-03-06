import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ProjectAccessGuard } from "../members/gaurds/project-access.guard.js";
import { ProjectRoles } from "../members/decorators/project-roles.decorator.js";
import { MemberRole } from "../members/schemas/project-member.schema.js";
import {
  CreateInvitationDto,
  RespondInvitationDto,
} from "./dto/invitation.dto.js";
import { InvitationsService } from "./invitations.service.js";

@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // POST /invitations/invite/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Post("invite/:projectId")
  async createInvitation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.createInvitation(
      actorId,
      correlationId,
      projectId,
      dto,
    );
  }

  // POST /invitations/request/:projectId
  @UseGuards(JwtAuthGuard)
  @Post("request/:projectId")
  async requestToJoinProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.invitationsService.requestToJoinProject(
      actorId,
      correlationId,
      projectId,
    );
  }

  // PATCH /invitations/invite
  @UseGuards(JwtAuthGuard)
  @Patch("invite")
  async respondToInvitation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.invitationsService.respondToInvitation(
      actorId,
      correlationId,
      dto,
    );
  }

  // PATCH /invitations/request/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Patch("request/:projectId")
  async processJoinRequest(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.invitationsService.processJoinRequest(
      actorId,
      correlationId,
      projectId,
      dto,
    );
  }

  // DELETE /invitations/invite/:projectId/:invitationId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Delete("invite/:projectId/:invitationId")
  async revokeInvitation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.invitationsService.revokeInvitation(
      actorId,
      correlationId,
      projectId,
      invitationId,
    );
  }

  // DELETE /invitations/request/:projectId/:requestId
  @UseGuards(JwtAuthGuard)
  @Delete("request/:projectId/:requestId")
  async revokeJoinRequest(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("requestId") requestId: string,
  ) {
    return this.invitationsService.revokeJoinRequest(
      actorId,
      correlationId,
      projectId,
      requestId,
    );
  }

  // GET /invitations/:projectId/stats
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Get(":projectId/stats")
  async getProjectTabStats(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.invitationsService.getProjectTabStats(
      actorId,
      correlationId,
      projectId,
    );
  }

  // GET /invitations/invite/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Get("invite/:projectId")
  async listInvitations(@Param("projectId") projectId: string) {
    return this.invitationsService.getPendingInvitations(projectId);
  }

  // GET /invitations/request/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Get("request/:projectId")
  async listRequests(@Param("projectId") projectId: string) {
    return this.invitationsService.getPendingJoinRequests(projectId);
  }
}
