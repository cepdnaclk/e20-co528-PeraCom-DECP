import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ConversationDocument = Conversation & Document;

export enum ConversationType {
  DIRECT = "DIRECT",
  GROUP = "GROUP",
}

// 💧 THE WATERMARK PATTERN
// Instead of marking 50 messages as "read", we just update this one sub-document.
class ParticipantRecord {
  @Prop({ required: true, index: true })
  userId!: string; // actorId

  @Prop({ default: Date.now })
  joinedAt!: Date;

  @Prop({ type: Types.ObjectId, required: false })
  lastReadMessageId?: Types.ObjectId; // The ID of the last message they saw

  @Prop({ required: false })
  lastReadAt?: Date; // Timestamp of when they last opened the chat
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: String, enum: ConversationType, required: true, index: true })
  type!: ConversationType;

  // For groups (e.g., "AI Research Team")
  @Prop({ required: false })
  title?: string;

  // We embed the participant details to handle read receipts efficiently
  @Prop({ type: [ParticipantRecord], required: true })
  participants!: ParticipantRecord[];

  @Prop({ required: true })
  createdBy!: string; // actorId who started it

  // ✨ INBOX OPTIMIZATION (Denormalization)
  // These fields update every time a new message is sent.
  // This allows `GET /conversations` to render the UI instantly without joining the Messages collection.
  @Prop({ required: false })
  lastMessageSnippet?: string; // e.g., "Sounds good, see you tomorrow!"

  @Prop({ required: false })
  lastMessageSenderId?: string;

  @Prop({ required: false, index: true })
  lastMessageAt?: Date; // Critical for sorting the Inbox (newest active chats first)
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Index to quickly find all conversations a specific user is in, sorted by most recent activity
ConversationSchema.index({ "participants.userId": 1, lastMessageAt: -1 });
