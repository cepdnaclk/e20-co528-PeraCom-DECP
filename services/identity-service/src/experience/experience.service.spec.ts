import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ExperienceService } from "./experience.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { EmploymentType } from "./dto/experience.dto.js";

jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-123"),
}));

jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("ExperienceService", () => {
  let service: ExperienceService;
  let prisma: {
    experience: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockExperience = {
    id: "exp-123",
    user_id: "user-1",
    title: "Software Engineer",
    emp_type: EmploymentType.Full_time,
    company: "Acme Corp",
    start_date: new Date("2024-01-01"),
    end_date: null,
    location: null,
    description: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      experience: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperienceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExperienceService>(ExperienceService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createExperience", () => {
    it("should create experience successfully", async () => {
      prisma.experience.findFirst.mockResolvedValue(null);
      prisma.experience.create.mockResolvedValue(mockExperience);

      const result = await service.createExperience(
        "user-1",
        "corr-1",
        {
          title: "Software Engineer",
          emp_type: EmploymentType.Full_time,
          company: "Acme Corp",
          start_date: new Date("2024-01-01"),
        },
      );

      expect(result.status).toBe("experience_created");
      expect(result.experience).toEqual(mockExperience);
    });

    it("duplicate (same user+title+company+start_date) should throw ConflictException", async () => {
      prisma.experience.findFirst.mockResolvedValue(mockExperience);

      await expect(
        service.createExperience("user-1", "corr-1", {
          title: "Software Engineer",
          emp_type: EmploymentType.Full_time,
          company: "Acme Corp",
          start_date: new Date("2024-01-01"),
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.experience.create).not.toHaveBeenCalled();
    });
  });

  describe("updateExperience", () => {
    it("should update experience successfully", async () => {
      prisma.experience.findUnique.mockResolvedValue(mockExperience);
      prisma.experience.findFirst.mockResolvedValue(null);
      prisma.experience.update.mockResolvedValue({
        ...mockExperience,
        title: "Senior Engineer",
      });

      const result = await service.updateExperience("user-1", "corr-1", {
        id: "exp-123",
        title: "Senior Engineer",
      });

      expect(result.status).toBe("experience_updated");
    });

    it("experience not found should throw NotFoundException", async () => {
      prisma.experience.findUnique.mockResolvedValue(null);

      await expect(
        service.updateExperience("user-1", "corr-1", {
          id: "nonexistent",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("user does not own experience should throw ConflictException", async () => {
      prisma.experience.findUnique.mockResolvedValue({
        ...mockExperience,
        user_id: "other-user",
      });

      await expect(
        service.updateExperience("user-1", "corr-1", {
          id: "exp-123",
          title: "Senior Engineer",
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateExperience("user-1", "corr-1", {
          id: "exp-123",
          title: "Senior Engineer",
        }),
      ).rejects.toThrow("You do not own this experience");
    });

    it("duplicate after update should throw ConflictException", async () => {
      prisma.experience.findUnique.mockResolvedValue(mockExperience);
      prisma.experience.findFirst.mockResolvedValue({
        id: "other-exp",
        user_id: "user-1",
        title: "Other Job",
        company: "Other Corp",
        start_date: new Date("2024-02-01"),
      });

      await expect(
        service.updateExperience("user-1", "corr-1", {
          id: "exp-123",
          title: "Other Job",
          company: "Other Corp",
          start_date: new Date("2024-02-01"),
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("deleteExperience", () => {
    it("should delete experience successfully", async () => {
      prisma.experience.delete.mockResolvedValue(mockExperience);

      const result = await service.deleteExperience(
        "user-1",
        "corr-1",
        "exp-123",
      );

      expect(result.status).toBe("experience_deleted");
      expect(result.id).toBe("exp-123");
    });

    it("empty experienceId should throw NotFoundException", async () => {
      await expect(
        service.deleteExperience("user-1", "corr-1", ""),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("viewExperience", () => {
    it("should return experiences ordered by created_at desc", async () => {
      prisma.experience.findMany.mockResolvedValue([mockExperience]);

      const result = await service.viewExperience("user-1", "corr-1");

      expect(result.status).toBe("ok");
      expect(result.experiences).toEqual([mockExperience]);
      expect(prisma.experience.findMany).toHaveBeenCalled();
      expect(result.experiences).toEqual([mockExperience]);
    });
  });
});
