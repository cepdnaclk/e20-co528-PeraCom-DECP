import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  Get,
  Query,
} from "@nestjs/common";
import { UsersService } from "./users.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import type { CreateUserDto } from "./dto/create-user.dto.js";
import type { CreateBulkDto } from "./dto/create-bulk.dto.js";
import type { BulkSuspendDto } from "./dto/suspend-bulk.dto.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";
import type {
  UpdateRolesDto,
  UpdateUserAdminDto,
} from "./dto/update-admin.dto.js";
import type { QueryUsersDto } from "./dto/query-users.dto.js";

@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

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

  // PATCH /users/bulk/suspend
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("bulk/suspend")
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

  // PATCH /users/roles
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("roles")
  updateRoles(
    @ActorId() admin: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateRolesDto,
  ) {
    return this.usersService.updateUserRoles(admin, correlationId, payload);
  }

  // PATCH /users/:id
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch(":id")
  updateUserByAdmin(
    @ActorId() adminId: string,
    @CorrelationId() correlationId: string,
    @Param("id") userId: string,
    @Body() userData: UpdateUserAdminDto,
  ) {
    return this.usersService.updateUserByAdmin(
      adminId,
      correlationId,
      userId,
      userData,
    );
  }

  // GET /users/me
  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMyProfile(
    @ActorId() userId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.usersService.getMyProfile(userId, correlationId);
  }

  // GET /users/me - must be before :id to avoid "me" being captured as id
  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMyProfile(
    @ActorId() userId: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.usersService.getMyProfile(userId, correlationId);
  }

  // GET /users/:id
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getPublicProfile(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") id: string,
  ) {
    return this.usersService.getPublicProfile(actorId, correlationId, id);
  }

  // GET /users
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get()
  getUsers(
    @ActorId() adminId: string,
    @CorrelationId() correlationId: string,
    @Query() query: QueryUsersDto,
  ) {
    return this.usersService.getAdminUsers(adminId, correlationId, query);
  }
}
