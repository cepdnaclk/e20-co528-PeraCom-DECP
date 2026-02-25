jest.mock("../../prisma/prisma.service.js", () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy.js";
import { PrismaService } from "../../prisma/prisma.service.js";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  describe("validate", () => {
    it("valid token + active user should return { userId, role }", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-123" });

      const result = await strategy.validate({
        sub: "user-123",
        role: "STUDENT",
      });

      expect(result).toEqual({ userId: "user-123", role: "STUDENT" });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123", is_active: true },
        select: { id: true },
      });
    });

    it("user not found or inactive should throw UnauthorizedException", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: "user-123", role: "STUDENT" }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate({ sub: "user-123", role: "STUDENT" }),
      ).rejects.toThrow("Your account has been suspended or deactivated");
    });
  });
});
