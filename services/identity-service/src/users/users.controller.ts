import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
} from "@nestjs/common";
import { UsersService } from "./users.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import type { CreateBulkDto } from "./dto/create-bulk.dto.js";
import type { BulkSuspendDto } from "./dto/suspend-bulk.dto.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";

@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  // POST /users
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post()
  createUser(
    @Body() dto: CreateUserDto,
    @CorrelationId() correlationId: string,
    @ActorId() adminId: string,
  ) {
    return this.usersService.createSingleUser(dto, correlationId, adminId);
  }

  // POST /users/bulk/validate
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("bulk/validate")
  validateBulk(@Body() body: CreateBulkDto) {
    return this.usersService.validateBulkStudents(body.students);
  }

  // POST /users/bulk/create
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("bulk/create")
  bulkCreate(
    @Body() body: CreateBulkDto,
    @CorrelationId() correlationId: string,
    @ActorId() adminId: string,
  ) {
    return this.usersService.bulkCreateStudents(
      body.students,
      correlationId,
      adminId,
    );
  }

  // PATCH /users/:id/suspend
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch(":id/suspend")
  suspendUser(
    @Param("id") userId: string,
    @CorrelationId() correlationId: string,
    @ActorId() adminId: string,
  ) {
    return this.usersService.suspendSingleUser(userId, correlationId, adminId);
  }

  // PATCH /users/bulk/suspend
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("bulk-suspend")
  suspendBulk(
    @Body() dto: BulkSuspendDto,
    @CorrelationId() correlationId: string,
    @ActorId() adminId: string,
  ) {
    return this.usersService.suspendBulkUsers(
      dto.userIds,
      correlationId,
      adminId,
    );
  }

  // PATCH /users/me
  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMyProfile(
    @ActorId() actor: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(actor, correlationId, payload);
  }
}
