import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Event, EventSchema } from "../events/schemas/event.schema.js";
import { RsvpController } from "./rsvp.controller.js";
import { RsvpService } from "./rsvp.service.js";
import { Rsvp, RsvpSchema } from "./schemas/rsvp.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rsvp.name, schema: RsvpSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [RsvpController],
  providers: [RsvpService],
  exports: [RsvpService],
})
export class RsvpModule {}
