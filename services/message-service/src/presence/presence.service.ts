import { Injectable, Inject } from "@nestjs/common";
import type { RedisClientType } from "redis"; // Assuming you inject your Redis client

@Injectable()
export class PresenceService {
  constructor(
    @Inject("REDIS_CLIENT") private readonly redis: RedisClientType,
  ) {}

  async setOnline(userId: string): Promise<void> {
    // Set user as online. The key expires after 24 hours just in case of a zombie connection.
    await this.redis.set(`user:${userId}:status`, "online", { EX: 86400 });
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(`user:${userId}:status`);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.redis.get(`user:${userId}:status`);
    return status === "online";
  }
}
