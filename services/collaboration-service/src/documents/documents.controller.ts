import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ProjectAccessGuard } from "../members/gaurds/project-access.guard.js";
import { ProjectRoles } from "../members/decorators/project-roles.decorator.js";
import { MemberRole } from "../members/schemas/project-member.schema.js";
import { DocumentsService } from "./documents.service.js";
import { ConfirmUploadDto, RequestUploadUrlDto } from "./dto/document.dto.js";
import { ProjectVisibility } from "../projects/schemas/project.schema.js";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // POST /documents/upload/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR)
  @Post("upload/:projectId")
  async generateUploadUrl(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() payload: RequestUploadUrlDto,
  ) {
    return this.documentsService.generateUploadUrl(
      actorId,
      correlationId,
      projectId,
      payload,
    );
  }

  // POST /documents/confirm/:projectId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR)
  @Post("confirm/:projectId")
  async confirmUpload(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Body() payload: ConfirmUploadDto,
  ) {
    return this.documentsService.confirmUpload(
      actorId,
      correlationId,
      projectId,
      payload,
    );
  }

  // DELETE /documents/:projectId/:documentId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR)
  @Delete(":projectId/:documentId")
  async deleteDocument(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.deleteDocument(
      actorId,
      correlationId,
      projectId,
      documentId,
    );
  }

  // GET /documents/private-url/:projectId/:documentId
  @UseGuards(JwtAuthGuard, ProjectAccessGuard)
  @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR, MemberRole.VIEWER)
  @Get("private-url/:projectId/:documentId")
  async getPrivateDownloadUrl(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.getPrivateDownloadUrl(
      actorId,
      correlationId,
      projectId,
      documentId,
    );
  }

  // GET /documents/public-url/:projectId/:documentId
  @Get("public-url/:projectId/:documentId")
  async getPublicDownloadUrl(
    @CorrelationId() correlationId: string, // Use your custom decorator if it supports unauthenticated requests, otherwise generate one
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.getDownloadUrl(
      "unknown_user",
      correlationId,
      projectId,
      documentId,
      [ProjectVisibility.PUBLIC],
    );
  }

  // GET /documents/internal-url/:projectId/:documentId
  @UseGuards(JwtAuthGuard)
  @Get("internal-url/:projectId/:documentId")
  async getInternalDownloadUrl(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.getDownloadUrl(
      actorId,
      correlationId,
      projectId,
      documentId,
      [ProjectVisibility.PUBLIC, ProjectVisibility.INTERNAL],
    );
  }
}
