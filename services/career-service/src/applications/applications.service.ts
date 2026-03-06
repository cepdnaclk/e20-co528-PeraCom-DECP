import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { Multer } from "multer";
import {
  Application,
  ApplicationStatus,
  type ApplicationDocument,
} from "./schemas/application.schema.js";
import {
  Job,
  JobStatus,
  type JobDocument,
} from "../jobs/schemas/job.schema.js";
import type {
  ApplyJobDto,
  UpdateApplicationStatusDto,
} from "./dto/application.dto.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { env } from "../config/validateEnv.config.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { MinioService } from "../minio/minio.service.js";

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectPinoLogger(ApplicationsService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Application.name)
    private readonly appModel: Model<ApplicationDocument>,

    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,

    private readonly storageService: MinioService,
  ) {}

  // ========================================================================
  // APPLY FOR JOB (Candidate Action) - With MinIO Orphan Cleanup
  // ========================================================================
  async applyForJob(
    actorId: string,
    correlationId: string,
    payload: ApplyJobDto,
    resumeFile: Express.Multer.File,
    coverLetterFile?: Express.Multer.File,
  ) {
    // 1. Destructure the payload
    const { jobId } = payload;

    // 2. Resume File Validation (Required)
    if (!resumeFile) throw new BadRequestException("Resume file is required");
    if (resumeFile.mimetype !== "application/pdf")
      throw new BadRequestException("Only PDF resumes are accepted");
    if (resumeFile.size > env.MAX_FILE_SIZE_MB * 1024 * 1024)
      throw new BadRequestException(
        `Resume exceeds ${env.MAX_FILE_SIZE_MB}MB limit`,
      );

    // 3. Cover Letter File Validation (Optional)
    if (coverLetterFile) {
      if (coverLetterFile.mimetype !== "application/pdf")
        throw new BadRequestException("Only PDF cover letters are accepted");
      if (coverLetterFile.size > env.MAX_FILE_SIZE_MB * 1024 * 1024)
        throw new BadRequestException(
          `Cover letter exceeds ${env.MAX_FILE_SIZE_MB}MB limit`,
        );
    }

    // 4. Pre-flight DB checks
    const job = await this.jobModel.findById(jobId).lean().exec();
    if (!job) throw new NotFoundException("Job not found");
    if (job.status !== JobStatus.PUBLISHED)
      throw new ForbiddenException("Job is not published.");

    // 5. Generate MinIO Storage Paths
    const baseFilename = `${actorId}-${uuidv7()}.pdf`;
    const resumePath = `resumes/${jobId}/${baseFilename}`;
    const coverLetterPath = coverLetterFile
      ? `cover-letters/${jobId}/${baseFilename}`
      : undefined;

    // 6. Upload Files to MinIO
    // Using Promise.all so they upload to MinIO concurrently, saving time!
    try {
      const uploadPromises = [
        this.storageService.uploadPrivateFile(
          "resumes",
          resumePath,
          resumeFile.buffer,
          resumeFile.mimetype,
        ),
      ];

      if (coverLetterFile && coverLetterPath) {
        uploadPromises.push(
          this.storageService.uploadPrivateFile(
            "cover-letters",
            coverLetterPath,
            coverLetterFile.buffer,
            coverLetterFile.mimetype,
          ),
        );
      }

      await Promise.all(uploadPromises);
    } catch (err) {
      // If MinIO fails halfway, log it and abort
      this.logger.error(
        { err, correlationId, jobId },
        "Failed to upload files to MinIO",
      );

      throw new InternalServerErrorException(
        "File upload failed, please try again.",
      );
    }

    // 7. Save to Database
    try {
      const application = new this.appModel({
        jobId: job._id,
        applicantId: actorId,
        resumeUrl: resumePath,
        coverLetterUrl: coverLetterPath,
        status: ApplicationStatus.SUBMITTED,
      });

      const savedApp = await application.save();

      // 8. Atomic counter increment (Fire and forget)
      this.jobModel
        .updateOne({ _id: job._id }, { $inc: { applicationCount: 1 } })
        .exec()
        .catch((err) =>
          this.logger.error({ err, jobId }, `Failed to increment job counter`),
        );

      // 9. Emit Event
      const appSubmittedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "career.application.submitted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "career-service",
        correlationId,
        actorId,
        data: {
          application_id: savedApp._id.toString(),
          job_id: job._id.toString(),
          has_cover_letter: !!coverLetterPath,
        },
      };
      publishEvent("career.events", appSubmittedEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, applicationId: savedApp._id },
          "Failed to publish application submitted event",
        ),
      );

      // 10. Return the saved application
      return {
        applicationId: savedApp._id.toString(),
        message: "Application submitted successfully",
      };
    } catch (error: any) {
      // ✨ THE COMPENSATING TRANSACTION ✨
      // If MongoDB throws a Duplicate Key error, we MUST delete the MinIO files we just uploaded
      if (error.code === 11000) {
        // Run deletions concurrently
        const rollbackPromises = [
          this.storageService
            .deletePrivateFile("resume", resumePath)
            .catch((err: Error) =>
              this.logger.error(
                { err, path: resumePath },
                "Failed to rollback resume upload",
              ),
            ),
        ];

        if (coverLetterPath) {
          rollbackPromises.push(
            this.storageService
              .deletePrivateFile("cover-letter", coverLetterPath)
              .catch((err: Error) =>
                this.logger.error(
                  { err, path: coverLetterPath },
                  "Failed to rollback cover letter upload",
                ),
              ),
          );
        }

        await Promise.all(rollbackPromises);

        throw new ConflictException("You have already applied for this job.");
      }

      throw error;
    }
  }

  // ========================================================================
  // WITHDRAW APPLICATION (Candidate Action) - With Atomic Counter Decrement
  // ========================================================================
  async withdrawApplication(
    actorId: string,
    correlationId: string,
    applicationId: string,
  ) {
    // 1. Validate Application ID
    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException("Invalid application ID");

    // 2. Fetch Application and verify ownership
    const app = await this.appModel.findById(applicationId).lean().exec();
    if (!app) throw new NotFoundException("Application not found");
    if (app.applicantId !== actorId)
      throw new ForbiddenException("Not your application");

    // 3. Cannot withdraw if already rejected or accepted
    if (
      [
        ApplicationStatus.REJECTED,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.WITHDRAWN,
      ].includes(app.status)
    ) {
      throw new BadRequestException(
        `Cannot withdraw application in ${app.status} state.`,
      );
    }

    // 4. Atomic Concurrency Lock
    const withdrawnApp = await this.appModel.findOneAndUpdate(
      { _id: applicationId, status: app.status },
      { $set: { status: ApplicationStatus.WITHDRAWN } },
      { new: true },
    );

    if (!withdrawnApp) {
      this.logger.warn(
        { applicationId, correlationId },
        "Application already processed or withdrawn by another request",
      );

      return {
        success: true,
        message: "Application already processed or withdrawn",
      };
    }

    // 5. Atomically decrement the job counter so the recruiter sees accurate numbers
    this.jobModel
      .updateOne({ _id: app.jobId }, { $inc: { applicationCount: -1 } })
      .exec()
      .catch(console.error);

    // 6. Emit Event
    const withdrawnEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.application.withdrawn",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        application_id: withdrawnApp._id.toString(),
        job_id: withdrawnApp.jobId.toString(),
      },
    };
    publishEvent("career.events", withdrawnEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, applicationId },
        "Failed to publish application withdrawn event",
      ),
    );

    // 7. Return success message
    return { success: true, message: "Application successfully withdrawn" };
  }

  // ========================================================================
  // UPDATE APPLICATION STATUS (Recruiter Action) - Strict State Machine
  // ========================================================================
  async updateApplicationStatus(
    actorId: string,
    correlationId: string,
    payload: UpdateApplicationStatusDto,
  ) {
    const { applicationId, newStatus } = payload;

    // 1. Fetch Application (Time of Check)
    const app = await this.appModel.findById(applicationId).lean().exec();
    if (!app) throw new NotFoundException("Application not found");

    // Idempotency early-exit (Saves a DB call)
    if (app.status === newStatus) {
      this.logger.warn(
        `[CorrID: ${correlationId}] Idempotent status update for app ${applicationId}`,
      );

      throw new ConflictException(
        "Application already in the desired status. No update performed.",
      );
    }

    // 2. Fetch Job to verify ownership (Security Boundary)
    const job = await this.jobModel.findById(app.jobId).lean().exec();
    if (!job || job.postedBy !== actorId) {
      throw new ForbiddenException(
        "You do not have permission to manage this application",
      );
    }

    // 3. Candidate protections
    if (app.status === ApplicationStatus.WITHDRAWN) {
      throw new BadRequestException(
        "Candidate has withdrawn. Status cannot be changed.",
      );
    }

    // 4. ✨ The Concurrency Shield (Time of Use) ✨
    // We lock the query to `app.status` instead of using `$ne`.
    const updatedApp = await this.appModel.findOneAndUpdate(
      {
        _id: applicationId,
        status: app.status, // Lock: Must exactly match what we validated in Step 3
      },
      { $set: { status: newStatus } },
      { new: true },
    );

    // If updatedApp is null, it means the status changed in the database
    // during the milliseconds between Step 1 and Step 4!
    if (!updatedApp) {
      this.logger.warn(
        `[CorrID: ${correlationId}] Concurrency conflict: App ${applicationId} status changed before update.`,
      );
      throw new ConflictException(
        "The application status was modified by another action. Please refresh and try again.",
      );
    }

    // 5. Emit Event (Crucial for notifying the candidate!)
    const statusUpdateEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.application_status.updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        application_id: updatedApp._id.toString(),
        old_status: app.status,
        new_status: newStatus,
      },
    };

    publishEvent("career.events", statusUpdateEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, applicationId },
        "Failed to publish application status updated event",
      ),
    );

    // 6. Return the updated application
    return updatedApp;
  }

  // ========================================================================
  // GET PRESIGNED RESUME URL (Security Action) - Strict PII Protection
  // ========================================================================
  async getResumeDownloadUrl(
    actorId: string,
    correlationId: string,
    applicationId: string,
  ) {
    // 1. Validate Application ID
    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException("Invalid application ID");

    // 2. Fetch Application (Time of Check)
    const app = await this.appModel.findById(applicationId).lean().exec();
    if (!app) throw new NotFoundException("Application not found");

    const isApplicant = app.applicantId === actorId;
    let isJobOwner = false;

    // 3. If they aren't the applicant, check if they own the job
    if (!isApplicant) {
      const job = await this.jobModel.findById(app.jobId).lean().exec();
      isJobOwner = job?.postedBy === actorId;
    }

    // 4. Strict PII Check
    if (!isApplicant && !isJobOwner) {
      this.logger.warn(
        `[CorrID: ${correlationId}] Unauthorized resume access attempt by actor ${actorId} for application ${applicationId}`,
      );

      throw new ForbiddenException(
        "You do not have permission to view this resume.",
      );
    }

    // 5. Ask MinIO for a URL that expires in 15 minutes
    const presignedUrl = await this.storageService.generatePresignedGetUrl(
      "resumes",
      app.resume,
    );

    // 6. Kafka Event for Audit Trail
    const resumeAccessEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.resume_url.accessed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        application_id: app._id.toString(),
        access_type: isApplicant ? "applicant" : "recruiter",
      },
    };

    publishEvent("career.events", resumeAccessEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, applicationId },
        "Failed to publish resume accessed event",
      ),
    );

    // 7. Return the presigned URL to the client
    return { url: presignedUrl };
  }

  // ========================================================================
  // GET APPLICANTS FOR A JOB (Recruiter View) - Cursor Pagination
  // ========================================================================
  async getApplicationsForJob(
    actorId: string,
    jobId: string,
    correlationId: string,
    cursor?: string,
    limit = 10,
    statusFilter?: ApplicationStatus,
  ) {
    // 1. Validate Job ID
    if (!Types.ObjectId.isValid(jobId))
      throw new BadRequestException("Invalid job ID");

    // 2. Verify Job Ownership
    const job = await this.jobModel.findById(jobId).lean().exec();
    if (!job || job.postedBy !== actorId) {
      throw new ForbiddenException(
        "You do not have permission to view these applications",
      );
    }

    // 3. Build the query filter
    const filter: any = { jobId: new Types.ObjectId(jobId) };
    if (statusFilter) filter.status = statusFilter;
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    // 4. Fetch applications with pagination
    const apps = await this.appModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    // 5. Determine if there's a next page
    let nextCursor = null;
    if (apps.length > limit) {
      apps.pop();
      nextCursor = apps[apps.length - 1]?._id.toString();
    }

    // 6. Emit Event for Audit Trail
    const viewAppsEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.applications.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        job_id: jobId,
      },
    };

    publishEvent("career.events", viewAppsEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, jobId },
        "Failed to publish applications viewed event",
      ),
    );

    // 7. Return applications with next cursor and total count for frontend pagination controls
    return { data: apps, nextCursor, total: job.applicationCount };
  }

  // ========================================================================
  // GET USER'S OWN APPLICATIONS (Candidate View) - Cursor Pagination
  // ========================================================================
  async getUserApplications(
    actorId: string,
    correlationId: string,
    cursor?: string,
    limit = 10,
  ) {
    // 1. Build the query filter
    const filter: any = { applicantId: actorId };
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    // 2. Fetch applications with pagination
    const apps = await this.appModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    // 3. Emit Event for Audit Trail
    let nextCursor = null;
    if (apps.length > limit) {
      apps.pop();
      nextCursor = apps[apps.length - 1]?._id.toString();
    }

    // 4. Emit Event for Audit Trail
    const viewAppsEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.user_applications.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        user_id: actorId,
      },
    };

    publishEvent("career.events", viewAppsEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId },
        "Failed to publish user applications viewed event",
      ),
    );

    // 5. Return applications with next cursor
    return { data: apps, nextCursor };
  }
}
