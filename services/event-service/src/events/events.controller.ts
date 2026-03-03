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
  UseInterceptors,
} from "@nestjs/common";
import { EventsService } from "./events.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { CreateEventDto } from "./dto/event.dto.js";
import { EventStatus, EventType } from "./schemas/event.schema.js";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { env } from "../config/validateEnv.config.js";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // POST /events
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "flyer", maxCount: 1 },
        { name: "agenda", maxCount: 1 },
      ],
      {
        limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
      },
    ),
  )
  async createEvent(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: CreateEventDto,
  ) {
    return this.eventsService.createEvent(actorId, correlationId, payload);
  }

  // PATCH /events/:id/publish
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch(":id/publish")
  async publishEvent(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") eventId: string,
  ) {
    return this.eventsService.publishEvent(actorId, correlationId, eventId);
  }

  // DELETE /evets/:id
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete(":id")
  async closeEventByAdmin(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") eventId: string,
  ) {
    return this.eventsService.closeEvent(actorId, correlationId, eventId);
  }

  // GET /events/details/:id
  @UseGuards(JwtAuthGuard)
  @Get("details/:id")
  async viewPublishedEventDetail(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") eventId: string,
  ) {
    return this.eventsService.ViewDetail(actorId, correlationId, eventId);
  }

  // GET /events/admin?cursor=2026-01-01T10:00:00.000Z&cursorId=...&limit=10&search=ai&eventType=ONLINE&status=DRAFT
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("admin")
  async getAllEvents(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
    @Query("eventType") eventType?: EventType,
    @Query("status") status?: EventStatus,
  ) {
    return this.eventsService.getEventsFeed(
      actorId,
      correlationId,
      cursor,
      cursorId,
      limit,
      search,
      eventType,
      status,
    );
  }

  // GET /events?cursor=2026-01-01T10:00:00.000Z&cursorId=...&limit=10&search=ai&eventType=ONLINE
  @UseGuards(JwtAuthGuard)
  @Get()
  async getEventsFeed(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
    @Query("eventType") eventType?: EventType,
  ) {
    return this.eventsService.getEventsFeed(
      actorId,
      correlationId,
      cursor,
      cursorId,
      limit,
      search,
      eventType,
      EventStatus.PUBLISHED,
    );
  }
}
