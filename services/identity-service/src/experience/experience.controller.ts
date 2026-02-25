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
import type { ExperienceService } from "./experience.service.js";
import type {
  NewExperienceDto,
  UpdateExperienceDto,
} from "./dto/experience.dto.js";

@Controller("experience")
export class ExperienceController {
  constructor(private experienceService: ExperienceService) {}

  // POST /experience
  @UseGuards(JwtAuthGuard)
  @Post()
  createExperience(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: NewExperienceDto,
  ) {
    return this.experienceService.createExperience(
      actorId,
      correlationId,
      payload,
    );
  }

  // PATCH /experience
  @UseGuards(JwtAuthGuard)
  @Patch()
  updateExperience(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateExperienceDto,
  ) {
    return this.experienceService.updateExperience(
      actorId,
      correlationId,
      payload,
    );
  }

  // DELETE /experience/:id
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  deleteExperience(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") experienceId: string,
  ) {
    return this.experienceService.deleteExperience(
      actorId,
      correlationId,
      experienceId,
    );
  }

  // GET /experience
  @UseGuards(JwtAuthGuard)
  @Get()
  getAllExperience(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.experienceService.viewExperience(actorId, correlationId);
  }
}
