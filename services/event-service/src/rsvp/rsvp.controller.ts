import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { UpsertRsvpDto } from "./dto/upsert-rsvp.dto.js";
import { RsvpService } from "./rsvp.service.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";

@Controller("rsvp")
export class RsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  // POST /rsvp
  @UseGuards(JwtAuthGuard)
  @Post()
  async upsertRsvp(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpsertRsvpDto,
  ) {
    return this.rsvpService.upsertRsvp(actorId, correlationId, payload);
  }

  // GET /rsvp/events/:eventId/attendees?cursor=...&limit=20
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get(":eventId")
  async getAttendeesForEvent(
    @ActorId() actorId: string,
    @Param("eventId") eventId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.rsvpService.getAttendeesForEvent(
      actorId,
      eventId,
      cursor,
      limit,
    );
  }

  // GET /rsvp/me
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getUserRSVP(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.rsvpService.getUserRSVP(actorId, correlationId);
  }
}
