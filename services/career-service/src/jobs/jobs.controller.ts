import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JobsService } from "./jobs.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { CreateJobDto } from "./dto/create-job.dto.js";
import { EmploymentType, JobStatus } from "./schemas/job.schema.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // POST /jobs
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ALUMNI")
  @Post()
  async createJob(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: CreateJobDto,
  ) {
    return this.jobsService.createJob(actorId, correlationId, payload);
  }

  // GET /jobs/details/admin/:id
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("details/admin/:id")
  async viewJob(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.ViewJobDetails(actorId, correlationId, jobId);
  }

  // GET /jobs/details/my-created/:id
  @UseGuards(JwtAuthGuard)
  @Get("details/my-created/:id")
  async viewMyCreatedJob(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.ViewMyJobDetails(actorId, correlationId, jobId);
  }

  // GET /jobs/details/:id
  @UseGuards(JwtAuthGuard)
  @Get("details/:id")
  async viewPublishedJob(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.ViewJobDetails(
      actorId,
      correlationId,
      jobId,
      JobStatus.PUBLISHED,
    );
  }

  // GET /jobs/admin?cursor=xxx&limit=10&search=engineer&employmentType=FULL_TIME&status=DRAFT
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("admin")
  async getAdminJobFeed(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
    @Query("employmentType") employmentType?: EmploymentType,
    @Query("status") status?: JobStatus,
  ) {
    return this.jobsService.getJobsFeed(
      actorId,
      correlationId,
      cursor,
      limit,
      search,
      employmentType,
      status,
    );
  }

  // GET /jobs/my-created?cursor=xxx&limit=10&status=DRAFT&search=engineer
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ALUMNI")
  @Get("my-created")
  async getMyCreatedJobs(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("status") status?: JobStatus,
    @Query("search") search?: string,
  ) {
    return this.jobsService.getMyCreatedJobs(
      actorId,
      correlationId,
      cursor,
      limit,
      status,
      search,
    );
  }

  // GET /jobs?cursor=xxx&limit=10&search=engineer&employmentType=FULL_TIME
  @UseGuards(JwtAuthGuard)
  @Get()
  async getJobsFeed(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("search") search?: string,
    @Query("employmentType") employmentType?: EmploymentType,
  ) {
    return this.jobsService.getJobsFeed(
      actorId,
      correlationId,
      cursor,
      limit,
      search,
      employmentType,
      JobStatus.PUBLISHED,
    );
  }

  // PATCH /jobs/:id/publish
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ALUMNI")
  @Patch(":id/publish")
  async publishJob(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.publishJob(actorId, correlationId, jobId);
  }

  // DELETE /jobs/admin/:id
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete("admin/:id")
  async closeJobByAdmin(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.closeJobByAdmin(actorId, correlationId, jobId);
  }

  // DELETE /jobs/:id
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ALUMNI")
  @Delete(":id")
  async closeJobByOwner(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") jobId: string,
  ) {
    return this.jobsService.closeJobByOwner(actorId, correlationId, jobId);
  }
}
