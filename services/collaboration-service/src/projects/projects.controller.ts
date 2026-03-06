import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsService } from "./projects.service.js";
import { ProjectAccessGuard } from "../members/gaurds/project-access.guard.js";
import { ProjectRoles } from "../members/decorators/project-roles.decorator.js";
import { MemberRole } from "../members/schemas/project-member.schema.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { ProjectVisibility } from "./schemas/project.schema.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // POST /projects
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("STUDENT", "ALUMNI")
  @Post()
  async createProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: CreateProjectDto,
  ) {
    return this.projectsService.createProject(actorId, correlationId, payload);
  }

  // PATCH /projects
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR)
  @Patch(":projectId")
  async updateProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() payload: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(
      actorId,
      correlationId,
      projectId,
      payload,
    );
  }

  // DELETE /projects/admin/:projectId
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete("admin/:projectId")
  async removeProjectByAdmin(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.projectsService.removeProject(
      actorId,
      correlationId,
      projectId,
    );
  }

  // DELETE /projects/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER)
  @Delete("admin/:projectId")
  async archiveProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.projectsService.removeProject(
      actorId,
      correlationId,
      projectId,
    );
  }

  // GET /projects/detail/:id/public
  @Get("detail/:id/public")
  async getPublicProjectById(
    @CorrelationId() correlationId: string,
    @Param("id") projectId: string,
  ) {
    return this.projectsService.getProjectById(
      "unknown_user",
      correlationId,
      projectId,
      ProjectVisibility.PUBLIC,
    );
  }

  // GET /projects/detail/:id
  @UseGuards(JwtAuthGuard)
  @Get("detail/:id")
  async getProjectById(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") projectId: string,
  ) {
    return this.projectsService.getProjectById(
      actorId,
      correlationId,
      projectId,
    );
  }

  // GET /projects/public?cursor=...&cursorId=...&limit=10&search=ai
  @Get("public")
  async getPublicFeed(
    @Query("cursor") cursor?: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
  ) {
    return this.projectsService.getProjectsFeed(
      [ProjectVisibility.PUBLIC],
      cursor,
      cursorId,
      limit,
      search,
    );
  }

  // GET /projects/internal?cursor=...&cursorId=...&limit=10&search=ai
  @UseGuards(JwtAuthGuard)
  @Get("internal")
  async getInternalFeed(
    @Query("cursor") cursor?: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
  ) {
    return this.projectsService.getProjectsFeed(
      [ProjectVisibility.PUBLIC, ProjectVisibility.INTERNAL],
      cursor,
      cursorId,
      limit,
      search,
    );
  }

  // GET /projects/me?cursor=...&cursorId=...&limit=10&search=ai
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMyProjectsFeed(
    @ActorId() actorId: string,
    @Query("cursor") cursor?: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
  ) {
    return this.projectsService.getMyProjectsFeed(
      actorId,
      cursor,
      cursorId,
      limit,
      search,
    );
  }
}
