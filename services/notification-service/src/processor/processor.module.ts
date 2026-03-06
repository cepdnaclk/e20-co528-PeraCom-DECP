import { Module } from "@nestjs/common";
import { NotificationProcessorService } from "./notification-processor.service.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { PreferencesModule } from "../preferences/preferences.module.js";

@Module({
  imports: [
    NotificationsModule,
    PreferencesModule,
    // Note: EmailModule is @Global, so we don't need to import it here.
  ],
  providers: [NotificationProcessorService],
  exports: [NotificationProcessorService], // Exported so the Consumer can use it
})
export class ProcessorModule {}
