import { Test, TestingModule } from "@nestjs/testing";
import { PresenceController } from "./presence.controller.js";
import { PresenceService } from "./presence.service.js";

describe("PresenceController", () => {
  let controller: PresenceController;
  let presenceService: { setOnline: jest.Mock };

  beforeEach(async () => {
    presenceService = { setOnline: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PresenceController],
      providers: [{ provide: PresenceService, useValue: presenceService }],
    }).compile();

    controller = module.get<PresenceController>(PresenceController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("POST /presence/heartbeat should call setOnline with userId from req.user", async () => {
    const req = { user: { userId: "user-123" } };

    const result = await controller.heartbeat(req as Parameters<typeof controller.heartbeat>[0]);

    expect(presenceService.setOnline).toHaveBeenCalledWith("user-123");
    expect(result).toEqual({ status: "online" });
  });
});
