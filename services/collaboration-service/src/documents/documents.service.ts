import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ProjectDocument,
  type ProjectDocumentDoc,
} from "./schemas/project-document.schema.js";
import {
  Project,
  type ProjectDocument as ProjDoc,
} from "../projects/schemas/project.schema.js";
import {
  RequestUploadUrlDto,
  ConfirmUploadDto,
  GetDownloadUrlDto,
  DeleteDocumentDto,
} from "./dto/document.dto.js";
import { MinioService } from "../minio/minio.service.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { env } from "../config/validateEnv.config.js";

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(ProjectDocument.name)
    private readonly documentModel: Model<ProjectDocumentDoc>,

    @InjectModel(Project.name) private readonly projectModel: Model<ProjDoc>,
    private readonly storageService: MinioService,

    @InjectPinoLogger(DocumentsService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ========================================================================
  // STEP 1: REQUEST UPLOAD URL (Direct to MinIO)
  // ========================================================================
  async generateUploadUrl(
    actorId: string,
    correlationId: string,
    dto: RequestUploadUrlDto,
  ) {
    const { projectId, fileName, mimeType, sizeBytes } = dto;

    // Enterprise Security: Block dangerous file types
    const blockedTypes = [
      "application/x-msdownload",
      "application/x-sh",
      "text/javascript",
    ];
    if (blockedTypes.includes(mimeType)) {
      throw new BadRequestException(
        "This file type is not allowed for security reasons.",
      );
    }

    // Generate a secure, collision-free storage path
    const extension = fileName.split(".").pop() || "bin";
    const fileKey = `projects/${projectId}/${uuidv7()}.${extension}`;

    try {
      // Ask MinIO for a PUT URL valid for 15 minutes
      const uploadUrl = await this.storageService.generatePresignedPutUrl(
        "research-files",
        fileKey,
        env.MAX_TIME_LIMIT_MINUTES * 60,
      );

      // Kafka Event: Document Upload Initiated
      const event: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "collaboration.document_upload.initiated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          project_id: projectId,
          file_name: fileName,
          size_bytes: sizeBytes,
        },
      };
      publishEvent("collaboration.events", event).catch((err) =>
        this.logger.error(
          { err, projectId, fileName },
          "Failed to publish document upload initiated event",
        ),
      );

      return {
        uploadUrl,
        fileKey, // The frontend must save this and send it back in Step 2!
        expiresIn: env.MAX_TIME_LIMIT_MINUTES * 60,
      };
    } catch (error) {
      this.logger.error(
        { error, projectId, correlationId },
        "Failed to generate MinIO PUT URL",
      );
      throw new InternalServerErrorException(
        "Storage system is temporarily unavailable.",
      );
    }
  }

  // ========================================================================
  // STEP 2: CONFIRM UPLOAD & SAVE METADATA
  // ========================================================================
  async confirmUpload(
    actorId: string,
    correlationId: string,
    dto: ConfirmUploadDto,
  ) {
    const { projectId, fileKey, fileName, mimeType, sizeBytes } = dto;

    // 1. Verify the project exists
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) throw new NotFoundException("Project not found");

    try {
      // 2. Save the metadata document
      const doc = new this.documentModel({
        projectId: project._id,
        uploadedBy: actorId,
        fileName: fileName,
        fileKey: fileKey,
        mimeType: mimeType,
        sizeBytes: sizeBytes,
      });

      const savedDoc = await doc.save();

      // 3. Atomically update the project's document counter
      await this.projectModel.updateOne(
        { _id: project._id },
        { $inc: { documentCount: 1 } },
      );

      // 4. Emit the Event
      const uploadEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "collaboration.document.uploaded",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "collaboration-service",
        correlationId,
        actorId,
        data: {
          document_id: savedDoc._id.toString(),
          project_id: projectId,
          file_name: fileName,
          size_bytes: sizeBytes,
        },
      };
      publishEvent("collaboration.events", uploadEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, documentId: savedDoc._id },
          "Failed to publish document uploaded event",
        ),
      );

      return savedDoc;
    } catch (error) {
      // ✨ COMPENSATING TRANSACTION ✨
      // If MongoDB fails to save the metadata, the file in MinIO is now an "orphan".
      // We must explicitly delete it so we don't bleed storage space!
      this.logger.error(
        { error, fileKey: dto.fileKey },
        "Failed to save document metadata, rolling back MinIO file",
      );
      this.storageService
        .deleteFile("research-files", dto.fileKey)
        .catch((err) =>
          this.logger.error(
            `Critical: Failed to clean up orphaned file ${dto.fileKey}`,
            err,
          ),
        );

      throw new InternalServerErrorException("Failed to finalize file upload.");
    }
  }

  // ========================================================================
  // GET DOWNLOAD URL
  // ========================================================================
  async getDownloadUrl(
    actorId: string,
    correlationId: string,
    dto: GetDownloadUrlDto,
  ) {
    const { projectId, documentId } = dto;

    const doc = await this.documentModel
      .findOne({
        _id: documentId,
        projectId: new Types.ObjectId(projectId),
        isDeleted: false,
      })
      .lean()
      .exec();

    if (!doc) throw new NotFoundException("Document not found");

    // Generate a GET URL valid for 15 minutes
    const downloadUrl = await this.storageService.generatePresignedGetUrl(
      "research-files",
      doc.fileKey,
      env.MAX_TIME_LIMIT_MINUTES * 60,
    );

    // Kafka Event: Document Download Initiated
    const event: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.document_download.initiated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        document_id: doc._id.toString(),
        project_id: projectId,
        file_name: doc.fileName,
        size_bytes: doc.sizeBytes,
      },
    };

    publishEvent("collaboration.events", event).catch((err) =>
      this.logger.error(
        { err, correlationId, documentId: doc._id },
        "Failed to publish document download initiated event",
      ),
    );

    return { downloadUrl, fileName: doc.fileName };
  }

  // ========================================================================
  // DELETE DOCUMENT (Soft Delete & Counter Decrement)
  // ========================================================================
  async deleteDocument(
    actorId: string,
    correlationId: string,
    dto: DeleteDocumentDto,
  ) {
    const { projectId, documentId } = dto;

    // 1. Fetch the document
    // We check `isDeleted: false` to ensure idempotency (can't delete twice)
    const document = await this.documentModel
      .findOne({
        _id: documentId,
        projectId: new Types.ObjectId(projectId),
        isDeleted: false,
      })
      .exec();

    if (!document) {
      throw new NotFoundException("Document not found or already deleted");
    }

    // 2. Apply Soft Delete
    document.isDeleted = true;

    // 3. ✨ Atomic Transaction Start (Using MongoDB Session)
    // Because we are modifying two collections (Document and Project),
    // we should wrap this in a session to prevent counting errors.
    const session = await this.documentModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        // Step A: Save the soft-deleted document
        await document.save({ session });

        // Step B: Atomically decrement the project's document count
        await this.projectModel.updateOne(
          { _id: document.projectId },
          { $inc: { documentCount: -1 } },
          { session },
        );
      });
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Failed to process document deletion transaction",
      );
      throw new InternalServerErrorException("Failed to delete document.");
    } finally {
      await session.endSession();
    }

    // 4. Emit the Domain Event
    const deleteEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "collaboration.document.deleted",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "collaboration-service",
      correlationId,
      actorId,
      data: {
        document_id: document._id.toString(),
        project_id: projectId,
        file_name: document.fileName,
        file_key: document.fileKey, // Useful for the eventual MinIO cleanup
      },
    };

    publishEvent("collaboration.events", deleteEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, documentId: document._id },
        "Failed to publish document deleted event",
      ),
    );

    return { success: true, message: "Document moved to trash" };
  }
}
