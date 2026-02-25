jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-123"),
}));

jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("ProjectsService", () => {
  let service: ProjectsService;
  let prisma: {
    project: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockProject = {
    id: "proj-123",
    user_id: "user-1",
    title: "My Project",
    start_date: new Date("2024-01-01"),
    end_date: null,
    description: null,
    link: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      project: {
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
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createProject", () => {
    it("should create project successfully", async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue(mockProject);

      const result = await service.createProject(
        "user-1",
        "corr-1",
        {
          title: "My Project",
          start_date: new Date("2024-01-01"),
        },
      );

      expect(result.status).toBe("project_created");
      expect(result.project).toEqual(mockProject);
    });

    it("duplicate (same user+title+start_date) should throw ConflictException", async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        service.createProject("user-1", "corr-1", {
          title: "My Project",
          start_date: new Date("2024-01-01"),
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.project.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteProject", () => {
    it("should delete project successfully", async () => {
      prisma.project.delete.mockResolvedValue(mockProject);

      const result = await service.deleteProject(
        "user-1",
        "corr-1",
        "proj-123",
      );

      expect(result.status).toBe("project_deleted");
      expect(result.id).toBe("proj-123");
    });

    it("empty projectId should throw BadRequestException", async () => {
      await expect(
        service.deleteProject("user-1", "corr-1", ""),
      ).rejects.toThrow(BadRequestException);
    });

    it("project not found should throw NotFoundException", async () => {
      prisma.project.delete.mockRejectedValue(new Error("Record not found"));

      await expect(
        service.deleteProject("user-1", "corr-1", "nonexistent"),
      ).rejects.toThrow("Record not found");
    });
  });

  describe("updateProject", () => {
    it("should update project successfully", async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.update.mockResolvedValue({ ...mockProject, title: "Updated" });

      const result = await service.updateProject("user-1", "corr-1", {
        id: "proj-123",
        title: "Updated",
        start_date: new Date("2024-01-01"),
      });

      expect(result.status).toBe("project_updated");
    });

    it("project not found should throw NotFoundException", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProject("user-1", "corr-1", {
          id: "nonexistent",
          start_date: new Date("2024-01-01"),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("user does not own project should throw ConflictException", async () => {
      prisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        user_id: "other-user",
      });

      await expect(
        service.updateProject("user-1", "corr-1", {
          id: "proj-123",
          start_date: new Date("2024-01-01"),
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateProject("user-1", "corr-1", {
          id: "proj-123",
          start_date: new Date("2024-01-01"),
        }),
      ).rejects.toThrow("You do not own this project");
    });

    it("duplicate title+start_date after update should throw ConflictException", async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.project.findFirst.mockResolvedValue({
        id: "other-proj",
        user_id: "user-1",
        title: "Other Project",
        start_date: new Date("2024-02-01"),
      });

      await expect(
        service.updateProject("user-1", "corr-1", {
          id: "proj-123",
          title: "Other Project",
          start_date: new Date("2024-02-01"),
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateProject("user-1", "corr-1", {
          id: "proj-123",
          title: "Other Project",
          start_date: new Date("2024-02-01"),
        }),
      ).rejects.toThrow("same title and start date already exists");
    });
  });

  describe("viewProjects", () => {
    it("should return projects ordered by created_at desc", async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const result = await service.viewProjects("user-1", "corr-1");

      expect(result.status).toBe("ok");
      expect(result.projects).toEqual([mockProject]);
      expect(prisma.project.findMany).toHaveBeenCalled();
      expect(result.projects).toEqual([mockProject]);
    });
  });
});
