import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import {
  Notification,
  NotificationSchema,
} from "./schemas/notification.schema.js";
import { EmailService } from "../config/email.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  // ✨ Export MongooseModule so the Processor can inject the Notification model!
  exports: [MongooseModule, EmailService],
})
export class NotificationsModule {}
