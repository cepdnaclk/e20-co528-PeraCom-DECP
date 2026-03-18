import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type JobDocument = Job & Document;

export enum EmploymentType {
  FULL_TIME = "FULL_TIME",
  PART_TIME = "PART_TIME",
  CONTRACT = "CONTRACT",
  INTERNSHIP = "INTERNSHIP",
}

export enum JobStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CLOSED = "CLOSED",
}

export enum WorkMode {
  ON_SITE = "ON_SITE",
  REMOTE = "REMOTE",
  HYBRID = "HYBRID",
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Job {
  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ required: true })
  companyName!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, index: true })
  location!: string;

  @Prop({ type: String, enum: EmploymentType, required: true })
  employmentType!: EmploymentType;

  @Prop({ required: true, index: true })
  department!: string; // e.g., "Engineering", "Marketing"

  @Prop({ type: [String], default: [], index: true })
  tags!: string[]; // e.g., ["React", "Node.js", "Remote"]

  @Prop({ type: String, enum: WorkMode, required: true })
  workMode!: WorkMode;

  @Prop({ required: false })
  salaryRange?: string; // e.g., "$100k - $120k"

  @Prop({
    type: String,
    enum: JobStatus,
    default: JobStatus.DRAFT,
    index: true,
  })
  status!: JobStatus;

  @Prop({ required: true, index: true })
  postedBy!: string; // actorId (Alumni or Admin)

  @Prop({ default: 0 })
  applicationCount!: number;

  @Prop({ type: Date, required: true })
  deadline!: Date; // When the job automatically closes

  createdAt!: Date;
  updatedAt!: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// ✨ ENTERPRISE INDEXING ✨

// 1. Pagination & Feed Index (Super fast chronological sorting of published jobs)
JobSchema.index({ status: 1, createdAt: -1 });

// 2. The Full-Text Search Index (Powers the future Search Service/Endpoint)
// Assigns 'weights' so a match in the Title is ranked higher than a match in the Description.
JobSchema.index(
  { title: "text", description: "text", companyName: "text", tags: "text" },
  { weights: { title: 10, tags: 5, companyName: 3, description: 1 } },
);
