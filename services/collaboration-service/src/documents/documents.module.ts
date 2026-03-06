import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";
import {
  ProjectDocument,
  ProjectDocumentSchema,
} from "./schemas/project-document.schema.js";
import { Project, ProjectSchema } from "../projects/schemas/project.schema.js";
import {
  ProjectMember,
  ProjectMemberSchema,
} from "../members/schemas/project-member.schema.js";
import { MinioService } from "../minio/minio.service.js";
import { ProjectAccessGuard } from "../members/gaurds/project-access.guard.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectDocument.name, schema: ProjectDocumentSchema },
      { name: Project.name, schema: ProjectSchema },
      // Needed by ProjectAccessGuard for role-based authorization.
      { name: ProjectMember.name, schema: ProjectMemberSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, MinioService, ProjectAccessGuard],
})
export class DocumentsModule {}
