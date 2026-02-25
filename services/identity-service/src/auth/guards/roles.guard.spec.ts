import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard.js";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: { get: jest.Mock };

  const createMockContext = (user: { role: string }) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { get: jest.fn() };
    guard = new RolesGuard(reflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("no required roles metadata should return true", () => {
    reflector.get.mockReturnValue(undefined);

    const result = guard.canActivate(createMockContext({ role: "STUDENT" }));

    expect(result).toBe(true);
  });

  it("user has required role should return true", () => {
    reflector.get.mockReturnValue(["ADMIN"]);

    const result = guard.canActivate(createMockContext({ role: "ADMIN" }));

    expect(result).toBe(true);
  });

  it("user lacks required role should throw ForbiddenException", () => {
    reflector.get.mockReturnValue(["ADMIN"]);

    expect(() =>
      guard.canActivate(createMockContext({ role: "STUDENT" })),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(createMockContext({ role: "STUDENT" })),
    ).toThrow("Access denied");
  });
});
