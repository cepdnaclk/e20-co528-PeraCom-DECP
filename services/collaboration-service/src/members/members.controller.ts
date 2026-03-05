import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ProjectAccessGuard } from "./gaurds/project-access.guard.js";
import { ProjectRoles } from "./decorators/project-roles.decorator.js";
import { MemberRole } from "./schemas/project-member.schema.js";
import { MembersService } from "./members.service.js";
import type { UpdateMemberDto } from "./dto/update-member.dto.js";

@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // GET /members/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Get(":projectId")
  async getProjectMembers(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.membersService.getProjectMembers(
      actorId,
      correlationId,
      projectId,
    );
  }

  // PATCH /members/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Patch(":projectId")
  async updateMemberRole(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateMemberRole(
      actorId,
      correlationId,
      projectId,
      dto,
    );
  }

  // DELETE /members/:projectId/:targetUserId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Delete(":projectId/:targetUserId")
  async removeMember(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("targetUserId") targetUserId: string,
  ) {
    return this.membersService.removeMember(
      actorId,
      correlationId,
      projectId,
      targetUserId,
    );
  }
}
