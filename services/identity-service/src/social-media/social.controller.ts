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
import type { SocialService } from "./social.service.js";
import type {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
} from "./dto/social-media.dto.js";

@Controller("social")
export class SocialController {
  constructor(private socialService: SocialService) {}

  // POST /social
  @UseGuards(JwtAuthGuard)
  @Post()
  upsertSocialLinks(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: CreateSocialLinkDto,
  ) {
    return this.socialService.createSocialLink(actorId, correlationId, payload);
  }

  // PATCH /social
  @UseGuards(JwtAuthGuard)
  @Patch()
  updateSocialLink(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateSocialLinkDto,
  ) {
    return this.socialService.updateSocialLink(actorId, correlationId, payload);
  }

  // DELETE /social/:id
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  deleteSocialLink(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") linkId: string,
  ) {
    return this.socialService.deleteSocialLink(actorId, correlationId, linkId);
  }

  // GET /social
  @UseGuards(JwtAuthGuard)
  @Get()
  viewSocialLinks(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.socialService.viewSocialLinks(actorId, correlationId);
  }
}
