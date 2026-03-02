import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  EmploymentType,
  Job,
  JobStatus,
  type JobDocument,
} from "./schemas/job.schema.js";
import { CreateJobDto } from "./dto/create-job.dto.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus/dist/injector.js";
import type { Counter } from "prom-client";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,

    @InjectMetric("career_jobs_created_total")
    private jobCounter: Counter<string>,

    @InjectPinoLogger(JobsService.name)
    private readonly logger: PinoLogger,
  ) {}

  // =================================================
  // Create a Job (Defaults to DRAFT status)
  // =================================================
  async createJob(actorId: string, correlationId: string, dto: CreateJobDto) {
    // 1. Database Execution
    const createdJob = new this.jobModel({
      ...dto,
      postedBy: actorId,
      status: JobStatus.DRAFT, // Jobs must be explicitly published later
      applicationCount: 0,
    });

    const savedJob = await createdJob.save();

    // 2. If fails to create, an exception will be thrown and the following code won't execute
    if (!savedJob) {
      this.logger.error(
        { correlationId, actorId, jobData: dto },
        "Failed to create job",
      );
      throw new Error("Failed to create job");
    }

    // 3. Observability & Metrics
    this.jobCounter.inc({ status: JobStatus.DRAFT });

    // 4. Emit Kafka Event
    const jobCreatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        jobId: savedJob._id.toString(),
        company: savedJob.companyName,
        status: savedJob.status,
      },
    };

    // 5. Fire and forget the event
    publishEvent("career.events", jobCreatedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, jobId: savedJob._id },
        "Failed to publish job created event",
      );
    });

    // 6. Return the created job
    return {
      message: "Job created successfully",
      jobId: savedJob._id.toString(),
    };
  }

  // =================================================
  // Publish a Job (DRAFT -> PUBLISHED)
  // =================================================
  async publishJob(actorId: string, correlationId: string, jobId: string) {
    // 1. Input Validation (Fail fast for invalid IDs)
    if (!Types.ObjectId.isValid(jobId)) {
      throw new BadRequestException("Invalid job ID");
    }

    // 2. Fetch purely to validate ownership and existence (Reads are cheap)
    const job = await this.jobModel.findById(jobId).lean();
    if (!job) throw new NotFoundException("Job not found");

    if (job.postedBy !== actorId) {
      throw new ForbiddenException(
        "You do not have permission to publish this job",
      );
    }

    // 3. Idempotency check (Early exit if already published)
    if (job.status === JobStatus.PUBLISHED) {
      this.logger.warn(
        { correlationId, actorId, jobId },
        "Attempted to publish an already published job",
      );
      return { success: true, message: "Job is already published" };
    }

    // 4. Business Rule Enforcement
    if (job.status === JobStatus.CLOSED) {
      this.logger.warn(
        { correlationId, actorId, jobId },
        "Attempted to publish a closed job",
      );
      throw new BadRequestException("Cannot publish a closed job.");
    }

    // 5. ✨ THE ATOMIC STATE TRANSITION ✨
    // We tell MongoDB: "Find this exact job, BUT ONLY IF the status is still DRAFT.
    // If it is, change it to PUBLISHED. Do this in one single lock."
    const updatedJob = await this.jobModel.findOneAndUpdate(
      {
        _id: jobId,
        author: actorId,
        status: JobStatus.DRAFT, // The crucial concurrency filter
      },
      {
        $set: { status: JobStatus.PUBLISHED },
      },
      { new: true }, // Return the updated document
    );

    // 6. ✨ THE CONCURRENCY CATCH ✨
    // If updatedJob is null here, it means another request beat us to the database
    // a millisecond ago and changed the status! We silently succeed (idempotent).
    if (!updatedJob) {
      this.logger.warn(
        { correlationId, actorId, jobId },
        "Concurrency conflict caught for job publish",
      );
      return { success: true, message: "Job is already published" };
    }

    // 7. Metrics & Event Emission
    this.jobCounter.inc({ status: JobStatus.PUBLISHED });

    // 8. Safe Event Emission (Guaranteed to only fire ONCE)
    const jobPublishedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job.published",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        job_id: updatedJob._id.toString(),
        company: updatedJob.companyName,
        title: updatedJob.title,
      },
    };

    publishEvent("career.events", jobPublishedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, actorId, jobId: updatedJob._id },
        "Failed to emit job published event",
      );
    });

    // 9. Return the updated job
    return updatedJob;
  }

  // =================================================
  // Close a Job by Owner (PUBLISHED -> CLOSED)
  // =================================================
  async closeJobByOwner(actorId: string, correlationId: string, jobId: string) {
    // 1. Input Validation (Fail fast for invalid IDs)
    if (!Types.ObjectId.isValid(jobId)) {
      throw new BadRequestException("Invalid job ID");
    }

    // 2. ✨ THE ATOMIC STATE TRANSITION ✨
    // We tell MongoDB: "Find this job, BUT ONLY IF it is NOT already closed.
    // If it isn't, close it."
    const closedJob = await this.jobModel.findOneAndUpdate(
      {
        _id: jobId,
        author: actorId,
        status: { $ne: JobStatus.CLOSED },
      },
      { $set: { status: JobStatus.CLOSED } },
      { new: true },
    );

    // 3. ✨ THE CONCURRENCY CATCH ✨
    // If it's null, it is already closed or invalid job.
    if (!closedJob) {
      this.logger.warn(
        { correlationId, actorId, jobId },
        "Attempted to close an already closed or non-existent job",
      );

      throw new BadRequestException("Job is already closed or does not exist.");
    }

    // 4. Metrics
    this.jobCounter.inc();

    // 5. Emit Job Closed Event
    const jobClosedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job.closed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        job_id: closedJob._id.toString(),
        company: closedJob.companyName,
        closed_by_admin: false,
      },
    };

    publishEvent("career.events", jobClosedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, actorId, jobId: closedJob._id },
        "Failed to emit job closed event by owner",
      );
    });

    // 6. Return the closed job
    return {
      message: "Job closed successfully",
      job_id: closedJob._id.toString(),
    };
  }

  // =================================================
  // Close a Job by Admin (PUBLISHED -> CLOSED)
  // =================================================
  async closeJobByAdmin(actorId: string, correlationId: string, jobId: string) {
    // 1. Input Validation (Fail fast for invalid IDs)
    if (!Types.ObjectId.isValid(jobId)) {
      throw new BadRequestException("Invalid job ID");
    }

    // 2. ✨ THE ATOMIC STATE TRANSITION ✨
    // We tell MongoDB: "Find this job, BUT ONLY IF it is NOT already closed.
    // If it isn't, close it."
    const closedJob = await this.jobModel.findOneAndUpdate(
      {
        _id: jobId,
        status: { $ne: JobStatus.CLOSED },
      },
      { $set: { status: JobStatus.CLOSED } },
      { new: true },
    );

    // 3. ✨ THE CONCURRENCY CATCH ✨
    // If it's null, it is already closed or invalid job.
    if (!closedJob) {
      this.logger.warn(
        { correlationId, actorId, jobId },
        "Attempted to close an already closed or non-existent job",
      );

      throw new BadRequestException("Job is already closed or does not exist.");
    }

    // 4. Metrics
    this.jobCounter.inc();

    // 5. Emit Job Closed Event
    const jobClosedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job.closed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        job_id: closedJob._id.toString(),
        company: closedJob.companyName,
        closed_by_admin: true,
      },
    };

    publishEvent("career.events", jobClosedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, actorId, jobId: closedJob._id },
        "Failed to emit job closed event by admin",
      );
    });

    // 6. Return the closed job
    return {
      message: "Job closed successfully",
      job_id: closedJob._id.toString(),
    };
  }

  // =================================================
  // Get Jobs Feed (ADMIN -> ALL, OTHERS -> PUBLISHED)
  // =================================================
  async getJobsFeed(
    actorId: string,
    correlationId: string,
    cursor?: string,
    limit?: number,
    search?: string,
    employmentType?: EmploymentType,
    status?: JobStatus,
  ) {
    // 1. Enforce safe limits (prevent users from requesting 10,000 jobs at once)
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    // 2. Build the Query Filter
    // 🔒 Security: Students must ONLY see jobs that are actively published!
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    // 3. Apply Text Search (if provided)
    // This utilizes the highly optimized full-text index we created in the schema
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    // 4. Apply Additional Filters (e.g., "Only show me Full-Time jobs")
    if (employmentType) {
      filter.employmentType = employmentType;
    }

    // 5. Apply the Cursor (The Concurrency Shield)
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        throw new BadRequestException("Invalid cursor format");
      }
      // Fetch jobs older (less than) the last seen ID
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    // 6. Execute the Query using the Limit + 1 Trick
    const jobs = await this.jobModel
      .find(filter)
      .sort({ _id: -1 }) // Chronological order: Newest first
      .limit(safeLimit + 1)
      .lean() // .lean() strips heavy Mongoose metadata for blazing fast read speeds
      .exec();

    // 7. Resolve the Next Cursor
    let nextCursor: string | null = null;

    // If we got back more items than the requested limit, we know there is a next page!
    if (jobs.length > safeLimit) {
      const extraJob = jobs.pop(); // Remove the +1 lookahead item
      nextCursor = jobs[jobs.length - 1]?._id.toString() || ""; // The ID of the last real item
    }

    // 8. -Strip out internal fields before sending to client
    // For example, we don't need to send the internal 'postedBy' actorId if we are just showing the feed
    const sanitizedJobs = jobs.map((job) => ({
      id: job._id,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      employmentType: job.employmentType,
      tags: job.tags,
      salaryRange: job.salaryRange,
      createdAt: job.createdAt,
      deadline: job.deadline,
    }));

    // 9. Prometheus Metric
    this.jobCounter.inc();

    // 10. Kafka Event Emission
    const jobViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        cursor: cursor ?? null,
        limit: safeLimit,
        search: search ?? null,
        employmentType: employmentType ?? null,
      },
    };

    publishEvent("career.events", jobViewedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId },
        "Failed to publish job viewed event",
      ),
    );

    // 9. Return the Feed with Metadata
    return {
      data: sanitizedJobs,
      nextCursor,
    };
  }

  // =================================================
  // Get Job Details (ADMIN-> ALL, OTHERS-> PUBLISHED)
  // =================================================
  async ViewJobDetails(
    actorId: string,
    correlationId: string,
    jobId: string,
    status?: JobStatus,
  ) {
    // 1. Input Validation
    if (!Types.ObjectId.isValid(jobId))
      throw new BadRequestException("Invalid job ID");

    // 2. Fetch the Job (ADMIN can see all jobs, others only PUBLISHED)
    const filter = { _id: jobId } as any;
    if (status) {
      filter.status = status;
    }

    const job = await this.jobModel.findOne(filter).lean().exec();
    if (!job) throw new NotFoundException("Job not found");

    // 3. Metrics
    this.jobCounter.inc();

    // 4. Kafka Event Emission
    const jobDetailViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.job_detail.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        jobId: job._id.toString(),
      },
    };

    publishEvent("career.events", jobDetailViewedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, jobId },
        "Failed to publish job detail viewed event",
      ),
    );

    // 5. Return the Job Details
    return job;
  }

  // =================================================
  // Get All Jobs Created By Current User (ALUMNI)
  // =================================================
  async getMyCreatedJobs(
    actorId: string,
    correlationId: string,
    cursor?: string,
    limit?: number,
    status?: JobStatus,
    search?: string,
  ) {
    // 1. Enforce safe limits
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    // 2. Build owner-scoped filter
    const filter: any = {
      postedBy: actorId,
    };

    // 3. Optional status filter
    if (status) {
      filter.status = status;
    }

    // 4. Optional text search
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    // 5. Optional cursor filter
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        throw new BadRequestException("Invalid cursor format");
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    // 6. Query execution with limit + 1 pagination
    const jobs = await this.jobModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 7. Resolve next cursor
    let nextCursor: string | null = null;
    if (jobs.length > safeLimit) {
      jobs.pop();
      nextCursor = jobs[jobs.length - 1]?._id.toString() || "";
    }

    // 8. Response mapping
    const mappedJobs = jobs.map((job) => ({
      id: job._id,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      employmentType: job.employmentType,
      status: job.status,
      tags: job.tags,
      salaryRange: job.salaryRange,
      createdAt: job.createdAt,
      deadline: job.deadline,
      applicationCount: job.applicationCount,
    }));

    // 9. Metrics + event
    this.jobCounter.inc();

    const myJobsViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.my_jobs.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId,
      actorId,
      data: {
        cursor: cursor ?? null,
        limit: safeLimit,
        status: status ?? null,
        search: search ?? null,
      },
    };

    publishEvent("career.events", myJobsViewedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, actorId },
        "Failed to publish my jobs viewed event",
      );
    });

    // 10. Return paginated result
    return {
      data: mappedJobs,
      nextCursor,
    };
  }

  // =================================================
  // Get Job Details Created By Current User (ALUMNI)
  // =================================================
  async ViewMyJobDetails(
    actorId: string,
    correlationId: string,
    jobId: string,
  ) {
    // 1. Input Validation
    if (!Types.ObjectId.isValid(jobId))
      throw new BadRequestException("Invalid job ID");

    // 2. Fetch the Job
    const job = await this.jobModel
      .findOne({ _id: jobId, postedBy: actorId })
      .lean()
      .exec();
    if (!job) throw new NotFoundException("Job not found");

    // 3. Metrics
    this.jobCounter.inc();

    // 4. Kafka Event Emission
    const jobDetailViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "career.my_job_detail.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "career-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        jobId: job._id.toString(),
      },
    };

    publishEvent("career.events", jobDetailViewedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, actorId, jobId },
        "Failed to publish my_job detail viewed event",
      ),
    );

    // 5. Return the Job Details
    return job;
  }
}
