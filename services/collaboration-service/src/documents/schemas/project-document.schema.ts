import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ProjectDocumentDoc = ProjectDocument & Document;

@Schema({ timestamps: true })
export class ProjectDocument {
  @Prop({ type: Types.ObjectId, required: true, ref: "Project", index: true })
  projectId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  uploadedBy!: string; // actorId

  @Prop({ required: true })
  fileName!: string; // Original name (e.g., 'dataset_v1.csv')

  @Prop({ required: true })
  fileKey!: string; // The MinIO object path (e.g., 'projects/123/uuid.csv')

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  sizeBytes!: number;

  @Prop({ default: 1 })
  version!: number;

  @Prop({ default: false, index: true })
  isDeleted!: boolean; // Soft delete for research safety
}

export const ProjectDocumentSchema =
  SchemaFactory.createForClass(ProjectDocument);

// Index to quickly list active files in a project, newest first
ProjectDocumentSchema.index({ projectId: 1, isDeleted: 1, createdAt: -1 });
