import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { makeCounterProvider } from "@willsoto/nestjs-prometheus";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";
import { Project, ProjectSchema } from "./schemas/project.schema.js";
import {
  ProjectMember,
  ProjectMemberSchema,
} from "../members/schemas/project-member.schema.js";
import {
  ProjectInvitation,
  ProjectInvitationSchema,
} from "../invitations/schemas/project-invitation.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: ProjectInvitation.name, schema: ProjectInvitationSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    makeCounterProvider({
      name: "collaboration_projects_created_total",
      help: "Total number of collaboration projects created",
    }),
  ],
})
export class ProjectsModule {}
