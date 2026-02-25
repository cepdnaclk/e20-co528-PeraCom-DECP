import { Module } from "@nestjs/common";
import { EducationService } from "./education.service.js";
import { EducationController } from "./education.controller.js";

@Module({
  providers: [EducationService],
  controllers: [EducationController],
})
export class EducationModule {}
