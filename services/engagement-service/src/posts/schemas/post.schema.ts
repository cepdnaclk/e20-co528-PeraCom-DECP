import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

// Will handle media attachments in the future, but for now we can keep it simple with just text content.

export type PostDocument = Post & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Post {
  @Prop({ required: true })
  authorId!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: String, default: null })
  video!: string | null;

  @Prop({ default: 0 })
  likesCount!: number;

  @Prop({ default: 0 })
  commentsCount!: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Indexes for high-performance queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ authorId: 1 });
PostSchema.index({ _id: -1 }); // cursor pagination optimization
