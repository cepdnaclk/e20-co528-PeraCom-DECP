import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import {
  ProjectInvitation,
  ProjectInvitationSchema,
} from "./schemas/project-invitation.schema.js";
import {
  ProjectMember,
  ProjectMemberSchema,
} from "../members/schemas/project-member.schema.js";
import { Project, ProjectSchema } from "../projects/schemas/project.schema.js";
import { ProjectAccessGuard } from "../members/gaurds/project-access.guard.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectInvitation.name, schema: ProjectInvitationSchema },
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService, ProjectAccessGuard],
})
export class InvitationsModule {}
