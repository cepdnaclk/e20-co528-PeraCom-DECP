jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-123"),
}));

jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: {
    validateBulkStudents: jest.Mock;
    bulkCreateStudents: jest.Mock;
    createSingleUser: jest.Mock;
    suspendSingleUser: jest.Mock;
    suspendBulkUsers: jest.Mock;
    updateProfile: jest.Mock;
    updateUserByAdmin: jest.Mock;
    updateUserRoles: jest.Mock;
    getPublicProfile: jest.Mock;
    getMyProfile: jest.Mock;
    getAdminUsers: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      validateBulkStudents: jest.fn(),
      bulkCreateStudents: jest.fn(),
      createSingleUser: jest.fn(),
      suspendSingleUser: jest.fn(),
      suspendBulkUsers: jest.fn(),
      updateProfile: jest.fn(),
      updateUserByAdmin: jest.fn(),
      updateUserRoles: jest.fn(),
      getPublicProfile: jest.fn(),
      getMyProfile: jest.fn(),
      getAdminUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("validateBulk should delegate to usersService.validateBulkStudents", async () => {
    const body = { students: [] };
    usersService.validateBulkStudents.mockResolvedValue({ validCount: 0 });

    await controller.validateBulk(body);

    expect(usersService.validateBulkStudents).toHaveBeenCalledWith(body.students);
  });

  it("bulkCreate should delegate with correlationId and adminId", async () => {
    const body = { students: [] };
    usersService.bulkCreateStudents.mockResolvedValue({ count: 0 });

    await controller.bulkCreate(body, "corr-1", "admin-1");

    expect(usersService.bulkCreateStudents).toHaveBeenCalledWith(
      body.students,
      "corr-1",
      "admin-1",
    );
  });

  it("createUser should delegate to createSingleUser", async () => {
    const dto = {
      email: "a@eng.pdn.ac.lk",
      first_name: "A",
      last_name: "B",
      role: "STUDENT" as const,
    };
    usersService.createSingleUser.mockResolvedValue({ status: "user_created" });

    await controller.createUser(dto, "corr-1", "admin-1");

    expect(usersService.createSingleUser).toHaveBeenCalledWith(
      dto,
      "corr-1",
      "admin-1",
    );
  });

  it("getMyProfile should delegate to getMyProfile", async () => {
    usersService.getMyProfile.mockResolvedValue({ id: "user-1" });

    await controller.getMyProfile("user-1", "corr-1");

    expect(usersService.getMyProfile).toHaveBeenCalledWith("user-1", "corr-1");
  });
});
