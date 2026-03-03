import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import {
  Event,
  EventStatus,
  type EventDocument,
} from "./schemas/event.schema.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";

@Injectable()
export class EventExpirationCron {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectPinoLogger(EventExpirationCron.name)
    private readonly logger: PinoLogger,
  ) {}

  // Runs automatically (e.g., every hour at the top of the hour)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: "Asia/Colombo", // Set to your desired timezone
  })
  async handleExpiredEvents() {
    // 1. Generate a Trace/Correlation ID for this specific Cron run
    const cronCorrelationId = `cron-event-expiry-${uuidv7()}`;
    this.logger.info(
      { correlationId: cronCorrelationId },
      "Starting expired events cleanup worker",
    );

    try {
      // 2. Find all events that are PUBLISHED but their deadline is in the past
      // We use .select() to keep memory usage tiny, as we only need the ID and Company Name.
      const expiredEvents = await this.eventModel
        .find({
          status: EventStatus.PUBLISHED,
          endDate: { $lte: new Date() },
        })
        .select("_id eventType title")
        .lean()
        .exec();

      if (expiredEvents.length === 0) {
        this.logger.info(
          { correlationId: cronCorrelationId },
          "No expired events found. Worker finished.",
        );
        return;
      }

      this.logger.info(
        { correlationId: cronCorrelationId },
        `Found ${expiredEvents.length} expired events to process.`,
      );

      let processedCount = 0;

      // 3. Process each event safely
      for (const event of expiredEvents) {
        // ✨ THE DISTRIBUTED LOCK ✨
        // We attempt to update it, BUT ONLY IF it is still PUBLISHED.
        // If Pod B already processed this 1 millisecond ago, updatedEvent will be null here.
        const updatedEvent = await this.eventModel.findOneAndUpdate(
          { _id: event._id, status: EventStatus.PUBLISHED },
          { $set: { status: EventStatus.COMPLETED } },
          { new: true },
        );

        // If not null, it means THIS pod won the race and successfully closed the event.
        if (updatedEvent) {
          processedCount++;

          // 4. Emit the Kafka Event so Search and Notifications know it closed
          const eventClosedEvent: BaseEvent<any> = {
            eventId: uuidv7(),
            eventType: "event.closed",
            eventVersion: "1.0",
            timestamp: new Date().toISOString(),
            producer: "event-service",
            correlationId: cronCorrelationId,
            actorId: "system-cron", // Distinct actor so we know a human didn't do this
            data: {
              event_id: updatedEvent._id.toString(),
              title: updatedEvent.title,
              reason: "automated_deadline_expiry", // Useful metadata for analytics
            },
          };

          // Fire and forget, logging any individual event failures without crashing the loop
          publishEvent("career.events", eventClosedEvent).catch((err) => {
            this.logger.error(
              {
                err,
                correlationId: cronCorrelationId,
                eventId: updatedEvent._id,
              },
              "Failed to emit event closed event from cron worker",
            );
          });
        }
      }

      this.logger.info(
        { correlationId: cronCorrelationId, processedCount },
        "Successfully completed expired events cleanup worker",
      );
    } catch (error) {
      this.logger.error(
        { error, correlationId: cronCorrelationId },
        "CRITICAL: Event Expiration Cron failed",
      );
    }
  }
}
