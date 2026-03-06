import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { makeCounterProvider } from "@willsoto/nestjs-prometheus";
import { Event, EventSchema } from "./schemas/event.schema.js";
import { EventsController } from "./events.controller.js";
import { EventsService } from "./events.service.js";
import { MinioService } from "../minio/minio.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    MinioService,
    makeCounterProvider({
      name: "event_created_total",
      help: "Total number of events created",
    }),
  ],
})
export class EventsModule {}
