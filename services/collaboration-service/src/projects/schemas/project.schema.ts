import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ProjectDocument = Project & Document;

export enum ProjectVisibility {
  PRIVATE = "PRIVATE", // Only invited members
  INTERNAL = "INTERNAL", // Anyone in the university/org can find and request to join
  PUBLIC = "PUBLIC", // Anyone on the internet can view (read-only)
}

// Enable versionKey for Optimistic Concurrency Control (OCC)
@Schema({ timestamps: true, versionKey: "__v" })
export class Project {
  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({
    type: String,
    enum: ProjectVisibility,
    default: ProjectVisibility.PRIVATE,
    index: true,
  })
  visibility!: ProjectVisibility;

  // Soft Delete Flag
  @Prop({ default: false, index: true })
  isDeleted!: boolean;

  @Prop({ required: false })
  deletedAt?: Date;

  // Denormalized Counters
  @Prop({ default: 1 }) // Starts at 1 because the creator is the first member
  memberCount!: number;

  @Prop({ default: 0 })
  documentCount!: number;

  @Prop({ required: true, index: true })
  createdBy!: string; // actorId

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Text search index for the Discovery Feed
ProjectSchema.index({ title: "text", description: "text" });
