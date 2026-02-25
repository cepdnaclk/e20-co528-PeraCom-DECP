jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { AuthService } from "./auth.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

jest.mock("google-auth-library", () => {
  const fn = jest.fn();
  (globalThis as Record<string, unknown>).__googleVerifyMock = fn;
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: fn,
    })),
  };
});
const mockVerifyIdToken = (globalThis as Record<string, jest.Mock>)
  .__googleVerifyMock;

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwtService: { sign: jest.Mock };

  const mockUser = {
    id: "user-123",
    email: "john@eng.pdn.ac.lk",
    first_name: "John",
    last_name: "Doe",
    role: "STUDENT" as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      user: { findUnique: jest.fn() },
    };
    jwtService = { sign: jest.fn().mockReturnValue("mock-jwt-token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("loginWithGoogle", () => {
    it("valid Google token should return JWT and user", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "john@eng.pdn.ac.lk",
          email_verified: true,
        }),
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, is_active: true });

      const result = await service.loginWithGoogle("valid-token");

      expect(result).toHaveProperty("access_token", "mock-jwt-token");
      expect(result).toHaveProperty("user");
      expect(result.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        first_name: mockUser.first_name,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        role: mockUser.role,
      });
    });

    it("invalid Google token should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await expect(service.loginWithGoogle("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginWithGoogle("invalid-token")).rejects.toThrow(
        "Invalid Google Token",
      );
    });

    it("null payload from Google should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => null });

      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        "No payload from Google",
      );
    });

    it("email_verified false should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "john@eng.pdn.ac.lk",
          email_verified: false,
        }),
      });

      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        "Google email not verified",
      );
    });

    it("missing email in payload should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email_verified: true }),
      });

      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        "Email missing in Google token",
      );
    });

    it("user not in DB should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "unknown@eng.pdn.ac.lk",
          email_verified: true,
        }),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        "User not found. Please contact the system administrator.",
      );
    });

    it("inactive user in DB should throw UnauthorizedException", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "john@eng.pdn.ac.lk",
          email_verified: true,
        }),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.loginWithGoogle("token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
