import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { UsersService } from "./users.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-123"),
}));

jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("UsersService", () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockUser = {
    id: "user-123",
    email: "john@eng.pdn.ac.lk",
    reg_number: "john",
    first_name: "John",
    last_name: "Doe",
    role: "STUDENT" as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createSingleUser", () => {
    const dto = {
      email: "john@eng.pdn.ac.lk",
      first_name: "John",
      last_name: "Doe",
      role: "STUDENT" as const,
    };

    it("new email should create user and return user_created", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.createSingleUser(
        dto,
        "corr-1",
        "admin-1",
      );

      expect(result.status).toBe("user_created");
      expect(result.user).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.user.create.mock.calls[0][0].data.email).toBe(
        "john@eng.pdn.ac.lk",
      );
      expect(prisma.user.create.mock.calls[0][0].data.reg_number).toBe("john");
    });

    it("existing active user with same email should throw ConflictException", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        is_active: true,
      });

      await expect(
        service.createSingleUser(dto, "corr-1", "admin-1"),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createSingleUser(dto, "corr-1", "admin-1"),
      ).rejects.toThrow("Email already exists");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("existing inactive user should reactivate and update", async () => {
      const inactive = { ...mockUser, id: "old-id", is_active: false };
      prisma.user.findUnique.mockResolvedValue(inactive);
      prisma.user.update.mockResolvedValue({ ...inactive, is_active: true });

      const result = await service.createSingleUser(
        dto,
        "corr-1",
        "admin-1",
      );

      expect(result.status).toBe("user_created");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: inactive.id },
        data: expect.objectContaining({
          is_active: true,
          first_name: "John",
          last_name: "Doe",
          role: "STUDENT",
        }),
        select: expect.any(Object),
      });
    });

    it("should use default role STUDENT when not provided", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        role: "STUDENT",
      });

      await service.createSingleUser(
        { ...dto, role: undefined } as typeof dto,
        "corr-1",
        "admin-1",
      );

      expect(prisma.user.create.mock.calls[0][0].data.role).toBe("STUDENT");
    });
  });

  describe("validateBulkStudents", () => {
    it("all new emails should populate validStudents with no errors", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const students = [
        {
          email: "a@eng.pdn.ac.lk",
          first_name: "A",
          last_name: "A",
          role: "STUDENT" as const,
        },
      ];

      const result = await service.validateBulkStudents(students);

      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.validStudents).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("emails in DB should produce errors for those rows", async () => {
      prisma.user.findMany.mockResolvedValue([
        { email: "existing@eng.pdn.ac.lk" },
      ]);

      const students = [
        {
          email: "existing@eng.pdn.ac.lk",
          first_name: "E",
          last_name: "E",
          role: "STUDENT" as const,
        },
      ];

      const result = await service.validateBulkStudents(students);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].message).toContain("already exists in the system");
    });

    it("duplicate emails within file should produce errors", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const students = [
        {
          email: "dup@eng.pdn.ac.lk",
          first_name: "D",
          last_name: "1",
          role: "STUDENT" as const,
        },
        {
          email: "dup@eng.pdn.ac.lk",
          first_name: "D",
          last_name: "2",
          role: "STUDENT" as const,
        },
      ];

      const result = await service.validateBulkStudents(students);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].message).toContain("Duplicate email");
    });

    it("should normalize email (trim, lowercase)", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const students = [
        {
          email: "  Mixed@ENG.PDN.AC.LK  ",
          first_name: "M",
          last_name: "M",
          role: "STUDENT" as const,
        },
      ];

      const result = await service.validateBulkStudents(students);

      expect(result.validStudents[0].email).toBe("mixed@eng.pdn.ac.lk");
    });
  });

  describe("bulkCreateStudents", () => {
    it("all valid should create users and emit event", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.createMany.mockResolvedValue({ count: 2 });

      const students = [
        {
          email: "a@eng.pdn.ac.lk",
          first_name: "A",
          last_name: "A",
          role: "STUDENT" as const,
        },
        {
          email: "b@eng.pdn.ac.lk",
          first_name: "B",
          last_name: "B",
          role: "STUDENT" as const,
        },
      ];

      const result = await service.bulkCreateStudents(
        students,
        "corr-1",
        "admin-1",
      );

      expect(result.status).toBe("Users created");
      expect(result.count).toBe(2);
      expect(prisma.user.createMany).toHaveBeenCalled();
    });

    it("validation errors should throw BadRequestException and not create", async () => {
      prisma.user.findMany.mockResolvedValue([
        { email: "existing@eng.pdn.ac.lk" },
      ]);

      const students = [
        {
          email: "existing@eng.pdn.ac.lk",
          first_name: "E",
          last_name: "E",
          role: "STUDENT" as const,
        },
      ];

      await expect(
        service.bulkCreateStudents(students, "corr-1", "admin-1"),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.createMany).not.toHaveBeenCalled();
    });
  });

  describe("suspendSingleUser", () => {
    it("admin suspends other user should succeed", async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.suspendSingleUser(
        "user-123",
        "corr-1",
        "admin-1",
      );

      expect(result.message).toBe("User suspended successfully");
      expect(result.userId).toBe("user-123");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123", is_active: true },
        data: { is_active: false },
        select: expect.any(Object),
      });
    });

    it("admin tries to suspend self should throw BadRequestException", async () => {
      await expect(
        service.suspendSingleUser("admin-1", "corr-1", "admin-1"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.suspendSingleUser("admin-1", "corr-1", "admin-1"),
      ).rejects.toThrow("Admin cannot suspend themselves");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("suspendBulkUsers", () => {
    it("valid userIds should suspend and return affectedCount", async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.suspendBulkUsers(
        ["user-1", "user-2"],
        "corr-1",
        "admin-1",
      );

      expect(result.affectedCount).toBe(2);
    });

    it("adminId in userIds should throw BadRequestException", async () => {
      await expect(
        service.suspendBulkUsers(["user-1", "admin-1"], "corr-1", "admin-1"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.suspendBulkUsers(["user-1", "admin-1"], "corr-1", "admin-1"),
      ).rejects.toThrow("Admin cannot suspend themselves");
    });

    it("no users suspended should throw BadRequestException", async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.suspendBulkUsers(["nonexistent"], "corr-1", "admin-1"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.suspendBulkUsers(["nonexistent"], "corr-1", "admin-1"),
      ).rejects.toThrow("No users were suspended");
    });
  });

  describe("updateProfile", () => {
    it("actor updates own profile should succeed", async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateProfile(
        "user-123",
        "corr-1",
        { id: "user-123", first_name: "Jane" },
      );

      expect(result).toEqual(mockUser);
    });

    it("payload.id !== actorId should throw BadRequestException", async () => {
      await expect(
        service.updateProfile(
          "user-123",
          "corr-1",
          { id: "other-user", first_name: "Jane" },
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile(
          "user-123",
          "corr-1",
          { id: "other-user", first_name: "Jane" },
        ),
      ).rejects.toThrow("You can only update your own profile");
    });
  });

  describe("updateUserByAdmin", () => {
    it("admin updates another user should succeed", async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateUserByAdmin(
        "admin-1",
        "corr-1",
        "user-123",
        { first_name: "Jane" },
      );

      expect(result.user).toEqual(mockUser);
    });

    it("admin updates self should throw ForbiddenException", async () => {
      await expect(
        service.updateUserByAdmin(
          "admin-1",
          "corr-1",
          "admin-1",
          { first_name: "Jane" },
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateUserByAdmin(
          "admin-1",
          "corr-1",
          "admin-1",
          { first_name: "Jane" },
        ),
      ).rejects.toThrow("Admin cannot update their own profile here");
    });

    it("user not found should throw NotFoundException", async () => {
      prisma.user.update.mockRejectedValue(new Error("Record not found"));

      await expect(
        service.updateUserByAdmin(
          "admin-1",
          "corr-1",
          "nonexistent",
          { first_name: "Jane" },
        ),
      ).rejects.toThrow();
    });
  });

  describe("updateUserRoles", () => {
    it("admin updates roles for others should succeed", async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateUserRoles(
        "admin-1",
        "corr-1",
        { userIds: ["user-1", "user-2"], role: "ALUMNI" as const },
      );

      expect(result.affectedCount).toBe(2);
    });

    it("adminId in payload.userIds should throw ForbiddenException", async () => {
      await expect(
        service.updateUserRoles("admin-1", "corr-1", {
          userIds: ["user-1", "admin-1"],
          role: "STUDENT" as const,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateUserRoles("admin-1", "corr-1", {
          userIds: ["user-1", "admin-1"],
          role: "STUDENT" as const,
        }),
      ).rejects.toThrow("Admins cannot change their own role");
    });

    it("no users updated should throw BadRequestException", async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateUserRoles("admin-1", "corr-1", {
          userIds: ["nonexistent"],
          role: "STUDENT" as const,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getAdminUsers", () => {
    it("should return paginated users with meta", async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation((promises: Promise<unknown>[]) =>
        Promise.all(promises),
      );

      const result = await service.getAdminUsers("admin-1", "corr-1", {});

      expect(result.data).toEqual([mockUser]);
      expect(result.meta).toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("should apply search and role filters", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      prisma.$transaction.mockImplementation((promises: Promise<unknown>[]) =>
        Promise.all(promises),
      );

      await service.getAdminUsers("admin-1", "corr-1", {
        search: "john",
        role: "STUDENT",
      });

      expect(prisma.user.findMany).toHaveBeenCalled();
      const findManyCall = prisma.user.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.role).toBe("STUDENT");
    });
  });

  describe("getPublicProfile", () => {
    it("active user should return public fields", async () => {
      const publicUser = {
        id: "user-123",
        first_name: "John",
        last_name: "Doe",
      };
      prisma.user.findUnique.mockResolvedValue(publicUser);

      const result = await service.getPublicProfile(
        "actor-1",
        "corr-1",
        "user-123",
      );

      expect(result).toEqual(publicUser);
    });

    it("user not found should throw NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getPublicProfile("actor-1", "corr-1", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPublicProfile("actor-1", "corr-1", "nonexistent"),
      ).rejects.toThrow("User not found");
    });
  });

  describe("getMyProfile", () => {
    it("should return full profile", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMyProfile("user-123", "corr-1");

      expect(result).toEqual(mockUser);
    });

    it("user not found should throw NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getMyProfile("nonexistent", "corr-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
