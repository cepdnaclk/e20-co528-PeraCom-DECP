import { Module } from "@nestjs/common";
import { PresenceService } from "./presence.service.js";
import { PresenceController } from "./presence.controller.js";
import { RedisModule } from "../redis/redis.module.js";

@Module({
  imports: [RedisModule],
  providers: [PresenceService],
  controllers: [PresenceController],
})
export class PresenceModule {}
