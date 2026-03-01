import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: "Post", required: true, index: true })
  postId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  authorId!: string;

  @Prop({ required: true, maxlength: 2000 })
  content!: string;

  @Prop({ default: false })
  isEdited!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// ✨ Enterprise Indexing ✨
// When users load a post, we query by postId and sort by _id.
// This compound index makes that specific query run in <5ms.
CommentSchema.index({ postId: 1, _id: -1 });
