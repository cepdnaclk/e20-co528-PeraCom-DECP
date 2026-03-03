import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Rsvp, RsvpStatus, type RsvpDocument } from "./schemas/rsvp.schema.js";
import {
  Event,
  EventStatus,
  type EventDocument,
} from "../events/schemas/event.schema.js";
import { UpsertRsvpDto } from "./dto/upsert-rsvp.dto.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class RsvpService {
  constructor(
    @InjectPinoLogger(RsvpService.name) private readonly logger: PinoLogger,
    @InjectModel(Rsvp.name) private readonly rsvpModel: Model<RsvpDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {}

  // =================================================
  // CREATE OR UPDATE RSVP
  // =================================================
  async upsertRsvp(
    actorId: string,
    correlationId: string,
    payload: UpsertRsvpDto,
  ) {
    // 1. Destructure the payload
    const { eventId, newStatus } = payload;

    // 2. Pre-flight checks on the Event
    const event = await this.eventModel.findById(eventId).lean().exec();
    if (!event) throw new NotFoundException("Event not found");
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException("You can only RSVP to published events.");
    }
    if (new Date(event.endDate) < new Date()) {
      throw new BadRequestException("This event has already ended.");
    }

    // 3. Fetch existing RSVP (if any)
    const existingRsvp = await this.rsvpModel
      .findOne({ eventId, userId: actorId })
      .exec();

    // 4. Idempotency early-exit: If they are already in the requested state, do nothing.
    if (existingRsvp && existingRsvp.status === newStatus) {
      this.logger.info(
        {
          correlationId,
          eventId,
          userId: actorId,
          status: newStatus,
        },
        "You are already marked as this status, no changes made.",
      );

      return {
        success: true,
        message: `You are already marked as ${newStatus}`,
        rsvp: existingRsvp,
      };
    }

    const oldStatus = existingRsvp ? existingRsvp.status : null;

    // 5. ✨ THE ATOMIC CAPACITY LOCK ✨
    // We must determine if we need to increment or decrement the event's rsvpCount.
    // Remember: Only 'GOING' takes up capacity. 'INTERESTED' does not.
    let capacityModifier = 0;

    if (newStatus === RsvpStatus.GOING && oldStatus !== RsvpStatus.GOING) {
      capacityModifier = 1; // Reserving a spot
    } else if (
      oldStatus === RsvpStatus.GOING &&
      newStatus !== RsvpStatus.GOING
    ) {
      capacityModifier = -1; // Releasing a spot
    }

    // 6. If a spot is being reserved or released, we must atomically update the Event.
    if (capacityModifier !== 0) {
      // If we are ADDING a user, we must strictly check the capacity limit inside the database query.
      const capacityFilter =
        capacityModifier === 1
          ? { _id: eventId, rsvpCount: { $lt: event.capacity } } // Lock: Only update if not full!
          : { _id: eventId }; // Releasing a spot doesn't need a capacity check

      const updatedEvent = await this.eventModel.findOneAndUpdate(
        capacityFilter,
        { $inc: { rsvpCount: capacityModifier } },
        { new: true },
      );

      // 7. If updatedEvent is null, it means the `$lt: event.capacity` condition failed. The event is full!
      if (!updatedEvent && capacityModifier === 1) {
        this.logger.warn(
          { correlationId, eventId },
          "Event is full, cannot update RSVP.",
        );

        throw new ConflictException(
          "This event is currently at full capacity.",
        );
      }
    }

    // 8. Update or Create the RSVP Document
    let finalRsvp;
    if (existingRsvp) {
      existingRsvp.status = newStatus;
      finalRsvp = await existingRsvp.save();
    } else {
      finalRsvp = await new this.rsvpModel({
        eventId: event._id,
        userId: actorId,
        status: newStatus,
      }).save();
    }

    // 9. Emit Domain Event (Crucial for the Notification Service!)
    const rsvpEventMsg: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: oldStatus ? "event.rsvp.updated" : "event.rsvp.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        event_id: eventId,
        user_id: actorId,
        old_status: oldStatus,
        new_status: newStatus,
        event_title: event.title, // Send title so Notification Service doesn't have to fetch it
      },
    };

    publishEvent("event.events", rsvpEventMsg).catch((err) =>
      console.error(
        `[CorrID: ${correlationId}] Failed to emit RSVP event:`,
        err.message,
      ),
    );

    // 10. Return the final RSVP document
    return finalRsvp;
  }

  // =================================================
  // GET ATTENDEES FOR EVENT ("GOING" STATUS)
  // =================================================
  async getAttendeesForEvent(
    actorId: string,
    eventId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    // 1. Validate Event ID format
    if (!Types.ObjectId.isValid(eventId))
      throw new BadRequestException("Invalid event ID");

    // 2. Enforce safe limits (e.g., fetching max 50 attendees at a time)
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    // 3. Fetch the event to ensure it exists
    const event = await this.eventModel.findById(eventId).lean().exec();
    if (!event) throw new NotFoundException("Event not found");

    // 4. Build Query: Only look for people marked 'GOING'
    const filter: any = {
      eventId: new Types.ObjectId(eventId),
      status: RsvpStatus.GOING,
    };

    // 5. Apply the Cursor (Based on MongoDB Object IDs for chronological stability)
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor))
        throw new BadRequestException("Invalid cursor format");
      // Find RSVPs created *before* the last seen cursor (to show oldest to newest)
      // Switch to $lt and sort by -1 if you want newest to oldest RSVPs
      filter._id = { $gt: new Types.ObjectId(cursor) };
    }

    // 6. Execute Query with Limit + 1 strategy
    const rsvps = await this.rsvpModel
      .find(filter)
      .sort({ _id: 1 }) // Chronological: First to register shows up first
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 7. Resolve the next cursor
    let nextCursor: string | null = null;
    if (rsvps.length > safeLimit) {
      rsvps.pop(); // Remove the lookahead item
      nextCursor = rsvps[rsvps.length - 1]?._id.toString() || null;
    }

    // 8. Sanitize Output
    // We only need to return the user ID. The Frontend or API Gateway
    // will hit the Identity Service to fetch their real names and avatars.
    const attendees = rsvps.map((rsvp) => ({
      userId: rsvp.userId,
      rsvpId: rsvp._id,
      registeredAt: rsvp.createdAt,
    }));

    // 9. Kafka Event Emission (Optional, but useful for analytics or other downstream services)
    const rsvpListEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "event.attendees.listed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId: uuidv7(), // New correlation ID for this internal event
      actorId,
      data: {
        event_id: eventId,
        fetched_count: attendees.length,
      },
    };

    publishEvent("event.events", rsvpListEvent).catch((err) =>
      this.logger.error(
        { correlationId: rsvpListEvent.correlationId, eventId },
        "Failed to emit attendees listed event:",
        err.message,
      ),
    );

    // 10. Return the paginated list of attendees along with metadata
    return {
      data: attendees,
      nextCursor,
      meta: {
        totalConfirmed: event.rsvpCount,
        capacity: event.capacity,
      },
    };
  }

  // =================================================
  // GET ALL USER REGISTERED EVENTS
  // =================================================
  async getUserRSVP(actorId: string, correlationId: string) {
    // 1. Fetch active RSVP records for this user
    // "Registered" means currently GOING or INTERESTED.
    const userRsvps = await this.rsvpModel
      .find({ userId: actorId })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()
      .exec();

    // 2. Early exit for empty result
    let sendData = {};
    if (userRsvps.length === 0) {
      this.logger.info(
        { correlationId, actorId },
        "No registered events found for user.",
      );

      sendData = { data: [], totalRegistered: 0 };
    } else {
      // 3. Fetch corresponding event documents in bulk
      const eventIds = userRsvps.map((rsvp) => rsvp.eventId);
      const events = await this.eventModel
        .find({ _id: { $in: eventIds } })
        .lean()
        .exec();

      const eventsById = new Map(
        events.map((event) => [event._id.toString(), event]),
      );

      // 4. Build response payload with timeline classification
      const now = new Date();

      const data = userRsvps
        .map((rsvp) => {
          const event = eventsById.get(rsvp.eventId.toString());
          if (!event) return null;

          return {
            rsvpId: rsvp._id,
            status: rsvp.status,
            registeredAt: rsvp.updatedAt,
            event: {
              id: event._id,
              title: event.title,
              description: event.description,
              eventType: event.eventType,
              startDate: event.startDate,
              endDate: event.endDate,
              timezone: event.timezone,
              capacity: event.capacity,
              rsvpCount: event.rsvpCount,
              status: event.status,
              meetingLink: event.meetingLink,
              address: event.address,
              bannerUrl: event.bannerUrl,
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      sendData = { data, totalRegistered: data.length };
    }

    // 5. Kafka Event Emission for Analytics
    const userRsvpEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "user.rsvp.listed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "event-service",
      correlationId,
      actorId,
      data: {
        user_id: actorId,
        rsvp_count: userRsvps.length,
      },
    };

    publishEvent("event.events", userRsvpEvent).catch((err) =>
      this.logger.error(
        { correlationId, actorId },
        "Failed to emit user RSVP listed event:",
        err.message,
      ),
    );

    return sendData;
  }
}
