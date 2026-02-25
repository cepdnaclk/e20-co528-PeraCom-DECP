jest.mock("../prisma/prisma.service.js", () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: { loginWithGoogle: jest.Mock };

  beforeEach(async () => {
    authService = { loginWithGoogle: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("POST /auth/google should call AuthService.loginWithGoogle with body.token", async () => {
    const token = "google-id-token-123";
    const expectedResult = {
      access_token: "jwt-token",
      user: { id: "1", email: "a@eng.pdn.ac.lk", role: "STUDENT" },
    };
    authService.loginWithGoogle.mockResolvedValue(expectedResult);

    const result = await controller.googleLogin({ token });

    expect(authService.loginWithGoogle).toHaveBeenCalledWith(token);
    expect(result).toEqual(expectedResult);
  });
});
