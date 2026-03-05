import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MembersController } from "./members.controller.js";
import { MembersService } from "./members.service.js";
import {
  ProjectMember,
  ProjectMemberSchema,
} from "./schemas/project-member.schema.js";
import { Project, ProjectSchema } from "../projects/schemas/project.schema.js";
import { ProjectAccessGuard } from "./gaurds/project-access.guard.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [MembersController],
  providers: [MembersService, ProjectAccessGuard],
})
export class MembersModule {}
