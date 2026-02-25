import { Test, TestingModule } from "@nestjs/testing";
import { PresenceService } from "./presence.service.js";
import { RedisService } from "../redis/redis.service.js";

describe("PresenceService", () => {
  let service: PresenceService;
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(null);
  const mockDel = jest.fn().mockResolvedValue(1);
  const mockRedis = {
    set: mockSet,
    get: mockGet,
    del: mockDel,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const redisService = {
      getClient: jest.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("setOnline", () => {
    it("should call Redis SET with correct key and TTL", async () => {
      await service.setOnline("user-123");

      expect(mockSet).toHaveBeenCalledWith(
        "online:user:user-123",
        "1",
        "EX",
        expect.any(Number),
      );
    });
  });

  describe("isOnline", () => {
    it("should return true when key exists with value 1", async () => {
      mockGet.mockResolvedValueOnce("1");

      const result = await service.isOnline("user-123");

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith("online:user:user-123");
    });

    it("should return false when key is missing", async () => {
      mockGet.mockResolvedValueOnce(null);

      const result = await service.isOnline("user-123");

      expect(result).toBe(false);
    });
  });

  describe("setOffline", () => {
    it("should call Redis DEL", async () => {
      await service.setOffline("user-123");

      expect(mockDel).toHaveBeenCalledWith("online:user:user-123");
    });
  });
});
