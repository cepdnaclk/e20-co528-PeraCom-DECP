import { Module } from "@nestjs/common";
import { ExperienceService } from "./experience.service.js";
import { ExperienceController } from "./experience.controller.js";

@Module({
  providers: [ExperienceService],
  controllers: [ExperienceController],
})
export class ExperienceModule {}
