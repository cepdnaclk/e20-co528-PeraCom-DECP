import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type EventDocument = Event & Document;

export enum EventType {
  ONLINE = "ONLINE",
  PHYSICAL = "PHYSICAL",
  HYBRID = "HYBRID",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Event {
  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: String, enum: EventType, required: true, index: true })
  eventType!: EventType;

  // Polymorphic Location Data
  @Prop({ required: false })
  meetingLink?: string; // Required if ONLINE or HYBRID

  @Prop({ required: false })
  address?: string; // Required if PHYSICAL or HYBRID

  // Strict Time Boundaries
  @Prop({ required: true, index: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ required: true })
  timezone!: string; // e.g., "Asia/Colombo"

  // Capacity & Counters
  @Prop({ required: true, min: 1 })
  capacity!: number;

  @Prop({ default: 0 })
  rsvpCount!: number; // Only tracks 'GOING', not 'INTERESTED'

  @Prop({
    type: String,
    enum: EventStatus,
    default: EventStatus.DRAFT,
    index: true,
  })
  status!: EventStatus;

  @Prop({ required: true, index: true })
  createdBy!: string; // actorId

  @Prop({ required: false })
  flyerUrl?: string;

  @Prop({ required: false })
  agendaUrl?: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// ✨ ENTERPRISE INDEXING ✨
// 1. Discovery Feed Index (Chronological upcoming events)
EventSchema.index({ status: 1, startDate: 1 });

// 2. Full-Text Search Index (For the Search Service later)
EventSchema.index(
  { title: "text", description: "text", address: "text" },
  { weights: { title: 10, address: 5, description: 1 } },
);
