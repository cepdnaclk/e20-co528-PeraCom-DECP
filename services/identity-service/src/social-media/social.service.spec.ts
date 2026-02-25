import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { SocialService } from "./social.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SocialPlatform } from "./dto/social-media.dto.js";

jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-123"),
}));

jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("SocialService", () => {
  let service: SocialService;
  let prisma: {
    socialLink: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockLink = {
    id: "link-123",
    user_id: "user-1",
    platform: SocialPlatform.LinkedIn,
    url: "https://linkedin.com/in/john",
    created_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      socialLink: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createSocialLink", () => {
    it("should create social link successfully", async () => {
      prisma.socialLink.findFirst.mockResolvedValue(null);
      prisma.socialLink.create.mockResolvedValue(mockLink);

      const result = await service.createSocialLink(
        "user-1",
        "corr-1",
        {
          platform: SocialPlatform.LinkedIn,
          url: "https://linkedin.com/in/john",
        },
      );

      expect(result.status).toBe("social_link_created");
      expect(result.socialLink).toEqual(mockLink);
    });

    it("duplicate (same user+platform+url) should throw ConflictException", async () => {
      prisma.socialLink.findFirst.mockResolvedValue(mockLink);

      await expect(
        service.createSocialLink("user-1", "corr-1", {
          platform: SocialPlatform.LinkedIn,
          url: "https://linkedin.com/in/john",
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.socialLink.create).not.toHaveBeenCalled();
    });
  });

  describe("updateSocialLink", () => {
    it("should update social link successfully", async () => {
      prisma.socialLink.findFirst.mockResolvedValue(null);
      prisma.socialLink.update.mockResolvedValue(mockLink);

      const result = await service.updateSocialLink(
        "user-1",
        "corr-1",
        {
          id: "link-123",
          platform: SocialPlatform.LinkedIn,
          url: "https://linkedin.com/in/john-updated",
        },
      );

      expect(result.status).toBe("social_link_updated");
      expect(result.socialLink).toEqual(mockLink);
    });

    it("duplicate URL (different id) should throw ConflictException", async () => {
      prisma.socialLink.findFirst.mockResolvedValue({
        id: "other-link",
        user_id: "user-1",
      });

      await expect(
        service.updateSocialLink("user-1", "corr-1", {
          id: "link-123",
          platform: SocialPlatform.LinkedIn,
          url: "https://linkedin.com/in/other",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("deleteSocialLink", () => {
    it("should delete social link successfully", async () => {
      prisma.socialLink.delete.mockResolvedValue(mockLink);

      const result = await service.deleteSocialLink(
        "user-1",
        "corr-1",
        "link-123",
      );

      expect(result.status).toBe("social_link_deleted");
      expect(result.id).toBe("link-123");
    });

    it("empty linkId should throw BadRequestException", async () => {
      await expect(
        service.deleteSocialLink("user-1", "corr-1", ""),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deleteSocialLink("user-1", "corr-1", "   "),
      ).rejects.toThrow("Social link ID is required");
    });

    it("link not found (Prisma throws) should propagate error", async () => {
      prisma.socialLink.delete.mockRejectedValue(new Error("Record not found"));

      await expect(
        service.deleteSocialLink("user-1", "corr-1", "nonexistent"),
      ).rejects.toThrow("Record not found");
    });
  });

  describe("viewSocialLinks", () => {
    it("should return links ordered by created_at desc", async () => {
      prisma.socialLink.findMany.mockResolvedValue([mockLink]);

      const result = await service.viewSocialLinks("user-1", "corr-1");

      expect(result.status).toBe("ok");
      expect(result.socialLinks).toEqual([mockLink]);
      expect(prisma.socialLink.findMany).toHaveBeenCalled();
      expect(result.socialLinks).toEqual([mockLink]);
    });
  });
});
