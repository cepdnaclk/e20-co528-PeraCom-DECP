import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  Delete,
  Get,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { ProjectsService } from "./projects.service.js";
import { NewProjectDto, UpdateProjectDto } from "./dto/projects.dto.js";

@Controller("projects")
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // POST /projects
  @UseGuards(JwtAuthGuard)
  @Post()
  createProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: NewProjectDto,
  ) {
    return this.projectsService.createProject(actorId, correlationId, payload);
  }

  // PATCH /projects
  @UseGuards(JwtAuthGuard)
  @Patch()
  updateProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(actorId, correlationId, payload);
  }

  // DELETE /projects/:id
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  deleteProject(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") projectId: string,
  ) {
    return this.projectsService.deleteProject(
      actorId,
      correlationId,
      projectId,
    );
  }

  // GET /projects
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getAllProjects(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") userId: string,
  ) {
    return this.projectsService.viewProjects(actorId, correlationId, userId);
  }
}
