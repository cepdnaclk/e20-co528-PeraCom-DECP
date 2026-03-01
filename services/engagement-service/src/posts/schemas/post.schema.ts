import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum ReactionType {
  LIKE = "LIKE",
  CELEBRATE = "CELEBRATE",
  SUPPORT = "SUPPORT", // LinkedIn's "Care"
  LOVE = "LOVE",
  HAHA = "HAHA",
  SAD = "SAD",
}

export type PostDocument = Post & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Post {
  @Prop({ required: true })
  authorId!: string;

  @Prop({ required: true, maxlength: 2000 })
  content!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: String, default: null })
  video!: string | null;

  @Prop({ default: 0 })
  totalReactions!: number;

  @Prop({
    type: Object,
    default: {
      LIKE: 0,
      CELEBRATE: 0,
      SUPPORT: 0,
      LOVE: 0,
      HAHA: 0,
      SAD: 0,
    },
  })
  reactionCounts!: Record<ReactionType, number>;

  @Prop({ default: 0 })
  commentsCount!: number;

  @Prop({ default: 0 })
  repostCount!: number;

  // ✨ If this document is a repost, this holds the ID of the original post
  @Prop({ type: Types.ObjectId, ref: "Post", required: false, index: true })
  originalPostId?: Types.ObjectId;

  @Prop({ default: false })
  isEdited!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Indexes for high-performance queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ authorId: 1 });
PostSchema.index({ _id: -1 }); // cursor pagination optimization
PostSchema.index(
  { authorId: 1, originalPostId: 1 },
  {
    unique: true,
    // This rule ONLY applies if they didn't write any content!
    partialFilterExpression: {
      originalPostId: { $exists: true },
      content: { $exists: false },
    },
  },
);
