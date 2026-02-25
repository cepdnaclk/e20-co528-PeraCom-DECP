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
import type { EducationService } from "./education.service.js";
import type {
  NewEducationDto,
  UpdateEducationDto,
} from "./dto/education.dto.js";

@Controller("education")
export class EducationController {
  constructor(private educationService: EducationService) {}

  // POST /education
  @UseGuards(JwtAuthGuard)
  @Post()
  createEducation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: NewEducationDto,
  ) {
    return this.educationService.createEducation(
      actorId,
      correlationId,
      payload,
    );
  }

  // PATCH /education
  @UseGuards(JwtAuthGuard)
  @Patch()
  updateEducation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateEducationDto,
  ) {
    return this.educationService.updateEducation(
      actorId,
      correlationId,
      payload,
    );
  }

  // DELETE /education/:id
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  deleteEducation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") educationId: string,
  ) {
    return this.educationService.deleteEducation(
      actorId,
      correlationId,
      educationId,
    );
  }

  // GET /education
  @UseGuards(JwtAuthGuard)
  @Get()
  getAllEducation(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.educationService.viewEducation(actorId, correlationId);
  }
}
