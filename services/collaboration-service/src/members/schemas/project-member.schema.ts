import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ProjectMemberDocument = ProjectMember & Document;

export enum MemberRole {
  OWNER = "OWNER",
  EDITOR = "EDITOR",
  VIEWER = "VIEWER",
}

@Schema({ timestamps: true })
export class ProjectMember {
  @Prop({ type: Types.ObjectId, required: true, ref: "Project", index: true })
  projectId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string; // actorId

  @Prop({ type: String, enum: MemberRole, required: true })
  role!: MemberRole;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);

// ✨ THE IDEMPOTENCY SHIELD ✨
// A user can only have ONE role per project.
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
