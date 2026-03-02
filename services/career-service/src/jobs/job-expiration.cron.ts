import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Job, JobStatus, type JobDocument } from "./schemas/job.schema.js";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";

@Injectable()
export class JobExpirationCron {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectPinoLogger(JobExpirationCron.name)
    private readonly logger: PinoLogger,
  ) {}

  // Runs automatically (e.g., every hour at the top of the hour)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: "Asia/Colombo", // Set to your desired timezone
  })
  async handleExpiredJobs() {
    // 1. Generate a Trace/Correlation ID for this specific Cron run
    const cronCorrelationId = `cron-job-expiry-${uuidv7()}`;
    this.logger.info(
      { correlationId: cronCorrelationId },
      "Starting expired jobs cleanup worker",
    );

    try {
      // 2. Find all jobs that are PUBLISHED but their deadline is in the past
      // We use .select() to keep memory usage tiny, as we only need the ID and Company Name.
      const expiredJobs = await this.jobModel
        .find({
          status: JobStatus.PUBLISHED,
          deadline: { $lte: new Date() },
        })
        .select("_id companyName")
        .lean()
        .exec();

      if (expiredJobs.length === 0) {
        this.logger.info(
          { correlationId: cronCorrelationId },
          "No expired jobs found. Worker finished.",
        );
        return;
      }

      this.logger.info(
        { correlationId: cronCorrelationId },
        `Found ${expiredJobs.length} expired jobs to process.`,
      );

      let processedCount = 0;

      // 3. Process each job safely
      for (const job of expiredJobs) {
        // ✨ THE DISTRIBUTED LOCK ✨
        // We attempt to update it, BUT ONLY IF it is still PUBLISHED.
        // If Pod B already processed this 1 millisecond ago, updatedJob will be null here.
        const updatedJob = await this.jobModel.findOneAndUpdate(
          {
            _id: job._id,
            status: JobStatus.PUBLISHED, // The Concurrency Shield
          },
          {
            $set: { status: JobStatus.CLOSED },
          },
          { new: true },
        );

        // If not null, it means THIS pod won the race and successfully closed the job.
        if (updatedJob) {
          processedCount++;

          // 4. Emit the Kafka Event so Search and Notifications know it closed
          const jobClosedEvent: BaseEvent<any> = {
            eventId: uuidv7(),
            eventType: "career.job.closed",
            eventVersion: "1.0",
            timestamp: new Date().toISOString(),
            producer: "career-service",
            correlationId: cronCorrelationId,
            actorId: "system-cron", // Distinct actor so we know a human didn't do this
            data: {
              job_id: updatedJob._id.toString(),
              company: updatedJob.companyName,
              reason: "automated_deadline_expiry", // Useful metadata for analytics
            },
          };

          // Fire and forget, logging any individual event failures without crashing the loop
          publishEvent("career.events", jobClosedEvent).catch((err) => {
            this.logger.error(
              { err, correlationId: cronCorrelationId, jobId: updatedJob._id },
              "Failed to emit job closed event from cron worker",
            );
          });
        }
      }

      this.logger.info(
        { correlationId: cronCorrelationId, processedCount },
        "Successfully completed expired jobs cleanup worker",
      );
    } catch (error) {
      this.logger.error(
        { error, correlationId: cronCorrelationId },
        "CRITICAL: Job Expiration Cron failed",
      );
    }
  }
}
