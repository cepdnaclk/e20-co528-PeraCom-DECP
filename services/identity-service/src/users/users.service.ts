import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { v7 as uuidv7 } from "uuid";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import type { CreateUserDto } from "./dto/create-user.dto.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";
import type {
  UpdateRolesDto,
  UpdateUserAdminDto,
} from "./dto/update-admin.dto.js";
import type { QueryUsersDto } from "./dto/query-users.dto.js";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // SINGLE USER CREATION LOGIC
  // ==========================================
  async createSingleUser(
    data: CreateUserDto,
    correlationId: string,
    adminId: string,
  ) {
    // 1. Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });

    let newUser;
    if (existing) {
      // 2. If email exists, throw an error
      if (existing.is_active) {
        console.log("Active user with email already exists:", data.email);
        throw new ConflictException("Email already exists");
      }

      // 3. If the existing user is not active, we can choose to reactivate and update their info instead of creating a new record
      console.log("Deactivated user. Reactive account: ", data.email);
      newUser = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          role: data.role || "STUDENT",
        },
        select: {
          id: true,
          email: true,
          reg_number: true,
          first_name: true,
          last_name: true,
          role: true,
        },
      });
    }

    // 4. No user found with the email, proceed to create a new one
    else {
      console.log("No existing users. Safe to proceed: ", data.email);
      newUser = await this.prisma.user.create({
        data: {
          id: uuidv7(),
          email: data.email.trim().toLowerCase(),
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          reg_number: data.email.split("@")[0] || "",
          role: data.role || "STUDENT",
        },
        select: {
          id: true,
          email: true,
          reg_number: true,
          first_name: true,
          last_name: true,
          role: true,
        },
      });
    }

    // 6. Broadcast the event so other services can prepare
    const userCreatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        user_id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
      },
    };

    await publishEvent("identity.events", userCreatedEvent);

    return { status: "user_created", user: newUser };
  }

  // ==========================================
  // BULK VALIDATION LOGIC
  // ==========================================
  async validateBulkStudents(students: CreateUserDto[]) {
    const errors = [];
    const validStudents = [];

    const processedEmailsInFile = new Set<string>();

    // 1. Pre-process the incoming data (trim & lowerCase)
    const normalizedStudents: CreateUserDto[] = students.map((s) => ({
      ...s,
      email: s.email.trim().toLowerCase(),
    }));

    const emails = normalizedStudents.map((s) => s.email);
    console.log("Validating bulk students emails:", emails);

    // 2. Fetch existing users from the DB in ONE query
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true }, // Only grab the email to save memory
    });

    const existingEmailSet = new Set(existingUsers.map((u) => u.email));

    // 3. Loop through and categorize
    for (let i = 0; i < normalizedStudents.length; i++) {
      const student = normalizedStudents[i] as CreateUserDto;

      // Error Type A: Already exists in the Database
      if (existingEmailSet.has(student.email)) {
        errors.push({
          row: i + 1,
          message: `Email ${student.email} already exists in the system`,
        });
        continue;
      }

      // Error Type B: Duplicate found within the uploaded CSV file itself
      if (processedEmailsInFile.has(student.email)) {
        errors.push({
          row: i + 1,
          message: `Duplicate email ${student.email} found in the uploaded file`,
        });
        continue;
      }

      // If it passes both checks, it's a valid new user
      processedEmailsInFile.add(student.email);
      validStudents.push(student);
    }

    return {
      validCount: validStudents.length,
      errorCount: errors.length,
      errors,
      validStudents,
    };
  }

  // ==========================================
  // BULK CREATION LOGIC
  // ==========================================
  async bulkCreateStudents(
    students: CreateUserDto[],
    correlationId: string,
    adminId: string,
  ) {
    // 1. Check for duplicates and separate valid students from errors
    const validationResult = await this.validateBulkStudents(students);

    // 2. If there are errors, return them immediately. Do not create partial batches.
    if (validationResult.errorCount > 0) {
      throw new BadRequestException({
        message: "Validation failed. Please fix errors and try again.",
        errors: validationResult.errors,
      });
    }

    // 3. If all students are valid, map the data for Prisma
    const usersToInsert = validationResult.validStudents.map((student) => {
      return {
        id: uuidv7(),
        email: student.email, // Already lowercased/trimmed in validate step
        first_name: student.first_name.trim(),
        last_name: student.last_name.trim(),
        reg_number: student.email.split("@")[0] || "",
        role: student.role || "STUDENT",
      };
    });

    // 4. Insert all valid students in a single query
    const created = await this.prisma.user.createMany({
      data: usersToInsert,
    });

    // 5. Broadcast a SINGLE Kafka event for the entire batch
    const batchCreatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.batch_users.created",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        count: created.count,
        users: usersToInsert.map((u) => ({
          user_id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
        })),
      },
    };

    await publishEvent("identity.events", batchCreatedEvent);

    // 6. Return the result
    return { status: "Users created", count: created.count };
  }

  // ==========================================
  // SINGLE SUSPEND LOGIC
  // ==========================================
  async suspendSingleUser(
    userId: string,
    correlationId: string,
    adminId: string,
  ) {
    // 1. Prevent admin from suspending themselves
    if (userId === adminId) {
      throw new BadRequestException("Admin cannot suspend themselves");
    }

    // 2. Check if user exists and is active
    const updatedUser = await this.prisma.user.update({
      where: { id: userId, is_active: true },
      data: { is_active: false },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
      },
    });

    console.log(`Attempted to suspend user ${userId}. Result:`, updatedUser);

    // 3. If user doesn't exist, throw an error
    if (!updatedUser) {
      throw new NotFoundException("User already be suspended or do not exist.");
    }

    // 4. Broadcast the event so other services can react accordingly
    const userSuspendedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user.suspended",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        user_id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
      },
    };
    await publishEvent("identity.events", userSuspendedEvent);

    // 5. Return the result
    return {
      message: "User suspended successfully",
      userId: updatedUser.id,
    };
  }

  // ==========================================
  // BULK SUSPEND LOGIC
  // ==========================================
  async suspendBulkUsers(
    userIds: string[],
    correlationId: string,
    adminId: string,
  ) {
    // 1. Prevent admin from suspending themselves
    if (userIds.includes(adminId)) {
      throw new BadRequestException("Admin cannot suspend themselves");
    }

    // 2. Suspend users in the database (only those that are currently active)
    const result = await this.prisma.user.updateMany({
      where: { id: { in: userIds }, is_active: true },
      data: { is_active: false },
    });

    console.log(
      `Attempted to suspend ${userIds.length} users. Actually suspended: ${result}`,
    );

    // 3. If no users were suspended, it could be because they were already suspended or didn't exist
    if (result.count === 0) {
      throw new BadRequestException(
        "No users were suspended. They may already be suspended or do not exist.",
      );
    }

    // 4. Broadcast a SINGLE Kafka event for the entire batch suspension
    const batchSuspendedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.batch_users.suspended",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        count: result.count,
        users: result,
      },
    };
    await publishEvent("identity.events", batchSuspendedEvent);

    return {
      message: "Users suspended successfully",
      affectedCount: result.count,
    };
  }

  // ==========================================
  // SELF PROFILE (GENERAL INFO) UPDATE LOGIC
  // ==========================================
  async updateProfile(
    actorId: string,
    correlationId: string,
    payload: UpdateProfileDto,
  ) {
    // 1. Check user updating his/her own profile (userId should match actorId from controller)
    if (payload.id !== actorId) {
      throw new BadRequestException("You can only update your own profile");
    }

    // 2. Prepare update data (only allow certain fields to be updated)
    const { id, ...updateData } = payload;

    // 3. Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: id, is_active: true },
      data: updateData,
    });

    // 4. If user doesn't exist, throw an error
    if (!updatedUser) throw new NotFoundException("User not found");

    // 5. Emit Kafka event
    const profileUpdatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user_profile.updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        user_id: updatedUser.id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
      },
    };
    await publishEvent("identity.events", profileUpdatedEvent);

    // 5. Return the updated profile
    return updatedUser;
  }

  // ======================================
  // ADMIN UPDATE USER INFO
  // ======================================
  async updateUserByAdmin(
    adminId: string,
    correlationId: string,
    userId: string,
    userData: UpdateUserAdminDto,
  ) {
    // 1. Admin cannot update their own profile through this endpoint
    if (adminId === userId) {
      throw new ForbiddenException(
        "Admin cannot update their own profile here",
      );
    }

    // 2. Prepare update data (only allow certain fields to be updated)
    const updatedUser = await this.prisma.user.update({
      where: { id: userId, is_active: true },
      data: userData,
      select: {
        id: true,
        email: true,
        reg_number: true,
        first_name: true,
        last_name: true,
        role: true,
      },
    });

    // 4. If user doesn't exist, throw an error
    if (!updatedUser) throw new NotFoundException("User not found");

    // 5. Emit Kafka event
    const userUpdatedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.admin_user.updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        user_id: updatedUser.id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
      },
    };
    await publishEvent("identity.events", userUpdatedEvent);

    return { message: "User updated successfully", user: updatedUser };
  }

  // ======================================
  // ROLE CHANGE (SINGLE + BULK)
  // ======================================
  async updateUserRoles(
    adminId: string,
    correlationId: string,
    payload: UpdateRolesDto,
  ) {
    // 1. Prevent self demotion
    if (payload.userIds.includes(adminId)) {
      throw new ForbiddenException("Admins cannot change their own role");
    }

    // 2. Update users in the database (only those that are currently active)
    const result = await this.prisma.user.updateMany({
      where: { id: { in: payload.userIds }, is_active: true },
      data: { role: payload.role },
    });

    console.log(
      `Attempted to update ${payload.userIds.length} users. Actually updated: ${result.count}`,
    );

    // 3. If no users were updated, it could be because they were already in the target role or didn't exist
    if (result.count === 0) {
      throw new BadRequestException(
        "No users were updated. They may already be in the target role or do not exist.",
      );
    }

    // 4. Broadcast a SINGLE Kafka event for the entire batch update
    const batchUpdateEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.batch_users.updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        count: result.count,
        users: result,
      },
    };
    await publishEvent("identity.events", batchUpdateEvent);

    return {
      message: "Role updated successfully",
      affectedCount: result.count,
    };
  }

  // ==========================================
  // ADMIN DIRECTORY (PAGINATED)
  // ==========================================
  async getAdminUsers(
    adminId: string,
    correlationId: string,
    query: QueryUsersDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Search
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { reg_number: { contains: query.search, mode: "insensitive" } },
        { first_name: { contains: query.search, mode: "insensitive" } },
        { last_name: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // 2. Role filter
    if (query.role) {
      where.role = query.role;
    }

    // 3. Only active users
    where.is_active = true;

    // 4. Fetch users with pagination and total count in a single transaction
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },

        // ⚡ LIGHTWEIGHT SELECT
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
          reg_number: true,
        },
      }),

      this.prisma.user.count({ where }),
    ]);

    // 5. Kafka event for admin user list retrieval (for analytics, monitoring, etc.)
    const userListRetrievedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user_list.retrieved",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: adminId,
      data: {
        count: total,
        users: users.map((u) => u.id),
      },
    };

    await publishEvent("identity.events", userListRetrievedEvent);

    // 6. Return paginated response
    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // PUBLIC PROFILE VIEW
  // ==========================================
  async getPublicProfile(
    actorId: string,
    correlationId: string,
    userId: string,
  ) {
    // 1. Fetch the user's public profile (only if active)
    const user = await this.prisma.user.findUnique({
      where: { id: userId, is_active: true },
      select: {
        id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        residence: true,
        profile_pic: true,
        header_img: true,
        headline: true,
        bio: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // 2. Broadcast a Kafka event for public profile view (for analytics, monitoring, etc.)
    const profileViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user_public.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        userId: user.id,
        viewedAt: new Date().toISOString(),
      },
    };

    await publishEvent("identity.events", profileViewedEvent);

    return user;
  }

  // ==========================================
  // MY ACCOUNT VIEW
  // ==========================================
  async getMyProfile(userId: string, correlationId: string) {
    console.log(`Fetching profile request`);

    // 1. Fetch the user's own profile (only if active)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        reg_number: true,
        email: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        residence: true,
        profile_pic: true,
        header_img: true,
        headline: true,
        bio: true,
        role: true,
      },
    });

    // 2. If user doesn't exist, throw an error
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // 3. Broadcast a Kafka event for "My Profile" retrieval (for analytics, monitoring, etc.)
    const profileViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "identity.user_profile.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "identity-service",
      correlationId: correlationId,
      actorId: userId,
      data: {
        viewedAt: new Date().toISOString(),
      },
    };

    await publishEvent("identity.events", profileViewedEvent);

    // 4. Return the user's own profile
    return user;
  }
}
