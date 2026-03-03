import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RsvpDocument = Rsvp & Document;

export enum RsvpStatus {
  GOING = "GOING",
  INTERESTED = "INTERESTED",
  CANCELLED = "CANCELLED",
}

@Schema({ timestamps: true })
export class Rsvp {
  @Prop({ type: Types.ObjectId, required: true, ref: "Event", index: true })
  eventId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string; // The actorId from JWT

  @Prop({ type: String, enum: RsvpStatus, required: true })
  status!: RsvpStatus;

  createdAt!: Date; // Auto-managed by Mongoose
  updatedAt!: Date; // Auto-managed by Mongoose
}

export const RsvpSchema = SchemaFactory.createForClass(Rsvp);

// ✨ THE IDEMPOTENCY SHIELD ✨
// A user can only have ONE RSVP state per event.
// If they change their mind, we UPDATE this document, we do not create a new one.
RsvpSchema.index({ eventId: 1, userId: 1 }, { unique: true });

// Used for "Show me all users GOING to this event"
RsvpSchema.index({ eventId: 1, status: 1 });
