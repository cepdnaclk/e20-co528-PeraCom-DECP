import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Event,
  EventStatus,
  EventType,
  type EventDocument,
} from "./schemas/event.schema.js";
import { CreateEventDto } from "./dto/event.dto.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus/dist/injector.js";
import type { Counter } from "prom-client";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class EventsService {
  constructor(
    @InjectPinoLogger(EventsService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,

    @InjectMetric("event_created_total")
    private eventCreatedCounter: Counter<string>,
  ) {}

  // =================================================
  // CREATE EVENT (Draft State)
  // =================================================
  async createEvent(
    actorId: string,
    correlationId: string,
    dto: CreateEventDto,
  ) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const now = new Date();

    // 🛡️ Strict Chronological Boundaries
    if (start < now)
      throw new BadRequestException("Start date cannot be in the past");
    if (end <= start)
      throw new BadRequestException("End date must be after start date");

    // Create the event in DRAFT status
    const newEvent = new this.eventModel({
      ...dto,
      startDate: start,
      endDate: end,
      createdBy: actorId,
      status: EventStatus.DRAFT,
      rsvpCount: 0,
    });

    // Save to DB
    const savedEvent = await newEvent.save();

    // Metrics: Increment total events created (in DRAFT state)
    this.eventCreatedCounter.inc({ status: EventStatus.DRAFT });

    // Emit 'Created' Event (Useful for Auditing & Analytics)
    const eventCreatedMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.new.created",
      eventVersion: "1.0",
      timestamp: now.toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: { event_id: savedEvent._id.toString(), type: savedEvent.eventType },
    };

    publishEvent("event.events", eventCreatedMsg).catch(console.error);

    // Return the created event (still in DRAFT)
    return savedEvent;
  }

  // =================================================
  // PUBLISH EVENT (DRAFT -> PUBLISHED)
  // =================================================
  async publishEvent(actorId: string, correlationId: string, eventId: string) {
    // Validate Event ID format
    if (!Types.ObjectId.isValid(eventId))
      throw new BadRequestException("Invalid ID");

    // Fetch the event
    const event = await this.eventModel.findById(eventId).lean().exec();
    if (!event) throw new NotFoundException("Event not found");

    // Security Check
    if (event.createdBy !== actorId) {
      this.logger.warn(
        `Unauthorized publish attempt by ${actorId} on event ${eventId} created by ${event.createdBy}`,
      );
      throw new ForbiddenException("Only the organizer can publish this event");
    }

    // Idempotency early exit
    if (event.status === EventStatus.PUBLISHED) {
      this.logger.warn(
        `Event ${eventId} is already published. Idempotent publish request received.`,
      );
      return { success: true, message: "Event already published", event };
    }

    // Cannot publish cancelled or completed events
    if ([EventStatus.CANCELLED, EventStatus.COMPLETED].includes(event.status)) {
      this.logger.warn(
        `Event ${eventId} is in ${event.status} status and cannot be published.`,
      );
      throw new BadRequestException(`Cannot publish a ${event.status} event`);
    }

    // Prevent publishing events where the start date has already passed while in Draft mode
    if (new Date(event.startDate) < new Date()) {
      this.logger.warn(
        `Event ${eventId} has a start date in the past and cannot be published.`,
      );
      throw new BadRequestException(
        "Cannot publish. The start date has already passed.",
      );
    }

    // 🛡️ Atomic Concurrency Lock
    const publishedEvent = await this.eventModel.findOneAndUpdate(
      { _id: eventId, status: EventStatus.DRAFT },
      { $set: { status: EventStatus.PUBLISHED } },
      { new: true },
    );

    if (!publishedEvent) {
      this.logger.warn(
        `Failed to publish event ${eventId}. It may have already been published or is not in DRAFT status.`,
      );
      return { success: true, message: "Event already processed" };
    }

    // Emit 'Published' Event (Crucial for the Discovery Feed & Notifications!)
    const eventPublishedMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.published",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        event_id: publishedEvent._id.toString(),
        title: publishedEvent.title,
        location_type: publishedEvent.eventType,
        start_date: publishedEvent.startDate.toISOString(),
      },
    };

    publishEvent("event.events", eventPublishedMsg).catch((err) =>
      this.logger.error(
        { err, eventId, correlationId, actorId },
        "Failed to publish event.published message",
      ),
    );

    // Return the published event
    return publishedEvent;
  }

  // =================================================
  // GET PUBLISHED EVENTS FEED
  // =================================================
  async getEventsFeed(
    actorId: string,
    correlationId: string,
    cursor?: string,
    cursorId?: string,
    limit?: number,
    search?: string,
    eventType?: EventType,
    status?: EventStatus,
  ) {
    // 1. Enforce safe limits (prevent malicious 10,000 document requests)
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    // 2. Build the Query Filter (The Core Logic)
    // 🛡️ Only show PUBLISHED events that haven't ended yet
    const now = new Date();

    const filter: any = {
      endDate: { $gt: now },
    };

    // 3. Optional Status Filter (For Admins or Future Use Cases)
    if (status) filter.status = status;

    // 4. Apply Text Search (Utilizes the schema's $text index)
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    // 5. Apply Event Type Filter (Online, Physical, Hybrid)
    if (eventType) {
      filter.eventType = eventType;
    }

    // 6. Apply the Cursor (The Concurrency Shield for Sorting)
    // For sorting by chronological time (not creation time), we need a composite cursor.
    // If multiple events start at exactly 9:00 AM, we use the _id as the tiebreaker to avoid duplicate entries.
    if (cursor && cursorId) {
      if (!Types.ObjectId.isValid(cursorId)) {
        throw new BadRequestException("Invalid cursorId format");
      }

      const cursorDate = new Date(cursor);

      // We want events starting *after* the last seen event's start date
      // Or events starting exactly at the same time, but with a greater _id
      filter.$or = [
        { startDate: { $gt: cursorDate } },
        {
          startDate: cursorDate,
          _id: { $gt: new Types.ObjectId(cursorId) },
        },
      ];
    } else if (cursor || cursorId) {
      // If they provide one but not the other, it's a bad request
      throw new BadRequestException(
        "Both cursor and cursorId are required for pagination",
      );
    }

    // 7. Execute the Query using the Limit + 1 Trick
    const events = await this.eventModel
      .find(filter)
      // Sort by soonest upcoming first (startDate ASC), tiebreak by _id ASC
      .sort({ startDate: 1, _id: 1 })
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 8. Resolve the Next Cursor
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;

    if (events.length > safeLimit) {
      const extraEvent = events.pop(); // Remove the +1 item

      // Set the cursor values to the LAST item returned in the valid set
      const lastEvent = events[events.length - 1];
      nextCursor = lastEvent?.startDate.toISOString() || null;
      nextCursorId = lastEvent?._id.toString() || null;
    }

    // 9. Sanitize Output Data
    const sanitizedEvents = events.map((event) => ({
      id: event._id,
      title: event.title,
      eventType: event.eventType,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      capacity: event.capacity,
      rsvpCount: event.rsvpCount,
      // If it's an physical event, send the address, otherwise send the link (if they are registered)
      location:
        event.eventType === EventType.PHYSICAL ||
        event.eventType === EventType.HYBRID
          ? event.address
          : undefined,
      bannerUrl: event.bannerUrl, // MinIO Presigned URL logic goes here if applicable
    }));

    // 10. Kafka Event: User Viewed Feed (Useful for Analytics & Personalization in the Future)
    const feedViewedMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.feed.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        appliedSearch: search || null,
        appliedType: eventType || null,
        returnedCount: sanitizedEvents.length,
      },
    };

    publishEvent("event.events", feedViewedMsg).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId },
        "Failed to publish event.feed.viewed message",
      ),
    );

    // 11. Return the Feed with Cursor Metadata
    return {
      data: sanitizedEvents,
      nextCursor,
      nextCursorId,
      meta: {
        appliedSearch: search || null,
        appliedType: eventType || null,
        count: sanitizedEvents.length,
      },
    };
  }

  // =================================================
  // CLOSE EVENT BY ADMIN (ANY -> CANCELLED)
  // =================================================
  async closeEvent(actorId: string, correlationId: string, eventId: string) {
    // 1. Input Validation
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }

    // 2. Atomic state transition for concurrency safety
    // If another request cancels/completes it first, this returns null.
    const closedEvent = await this.eventModel.findOneAndUpdate(
      {
        _id: eventId,
        status: { $nin: [EventStatus.CANCELLED, EventStatus.COMPLETED] },
      },
      { $set: { status: EventStatus.CANCELLED } },
      { new: true },
    );

    // 3. Concurrency catch + invalid state handling
    if (!closedEvent) {
      this.logger.warn(
        { correlationId, actorId, eventId },
        "Attempted to close an already terminal or non-existent event",
      );
      throw new BadRequestException(
        "Event is already cancelled/completed or does not exist.",
      );
    }

    // 4. Metrics
    this.eventCreatedCounter.inc({ status: EventStatus.CANCELLED });

    // 5. Emit Event Closed message
    const eventClosedMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.event.closed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        event_id: closedEvent._id.toString(),
        title: closedEvent.title,
        closed_by_admin: true,
      },
    };

    publishEvent("event.events", eventClosedMsg).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, eventId: closedEvent._id },
        "Failed to emit event closed event",
      ),
    );

    // 6. Return response
    return {
      message: "Event closed successfully",
      event_id: closedEvent._id.toString(),
    };
  }

  // =================================================
  // VIEW EVENT DETAIL (ANY USER -> PUBLISHED ONLY)
  // =================================================
  async ViewDetail(actorId: string, correlationId: string, eventId: string) {
    // 1. Input Validation
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }

    // 2. Fetch only published event details
    const event = await this.eventModel
      .findOne({ _id: eventId, status: EventStatus.PUBLISHED })
      .lean()
      .exec();

    if (!event) {
      throw new NotFoundException("Published event not found");
    }

    // 3. Metric
    this.eventCreatedCounter.inc();

    // 4. Emit detail viewed event
    const eventDetailViewedMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.detail.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        event_id: event._id.toString(),
      },
    };

    publishEvent("event.events", eventDetailViewedMsg).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, eventId },
        "Failed to publish event detail viewed event",
      ),
    );

    // 5. Return event details
    return event;
  }
}
