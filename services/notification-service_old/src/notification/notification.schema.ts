import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: "" })
  body!: string;

  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;

  @Prop({ default: false })
  read!: boolean;

  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true })
  eventType!: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
