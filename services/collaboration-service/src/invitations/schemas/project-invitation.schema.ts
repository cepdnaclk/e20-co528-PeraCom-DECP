import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { MemberRole } from "../../members/schemas/project-member.schema.js";

export type ProjectInvitationDocument = ProjectInvitation & Document;

export enum InvitationType {
  OUTBOUND_INVITE = "OUTBOUND_INVITE",
  INBOUND_REQUEST = "INBOUND_REQUEST",
}

export enum InvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  REVOKED = "REVOKED",
}

@Schema({ timestamps: true })
export class ProjectInvitation {
  @Prop({ type: Types.ObjectId, required: true, ref: "Project", index: true })
  projectId!: Types.ObjectId;

  @Prop({ required: true })
  inviterId!: string; // actorId of the person sending the invite

  // We support internal invites
  @Prop({ required: true, index: true })
  inviteeId!: string;

  @Prop({ required: true, index: true })
  inviteeEmail!: string;

  @Prop({ type: String, enum: MemberRole, required: true })
  role!: MemberRole;

  @Prop({ type: String, enum: InvitationType, required: true })
  type!: InvitationType;

  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
    index: true,
  })
  status!: InvitationStatus;

  // ✨ Auto-Expiration TTL Index
  // MongoDB will automatically delete this document when this date passes
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProjectInvitationSchema =
  SchemaFactory.createForClass(ProjectInvitation);

// Idempotency: A user cannot have multiple PENDING invites to the same project
ProjectInvitationSchema.index(
  { projectId: 1, inviteeId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: InvitationStatus.PENDING },
  },
);
