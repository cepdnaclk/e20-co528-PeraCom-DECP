import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ReactionType } from "../../posts/schemas/post.schema.js";

export type ReactionDocument = Reaction & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: "Post", required: true, index: true })
  postId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string; // The user who liked the post

  @Prop({ type: String, enum: ReactionType, required: true })
  type!: ReactionType;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

// ✨ THE IDEMPOTENCY MAGIC ✨
// This tells MongoDB: "A specific user can only have ONE reaction on a specific post."
// If they try to insert a second one, MongoDB will block it at the database level!
ReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
