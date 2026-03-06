import { Module } from "@nestjs/common";
import { NotificationConsumerService } from "./notification-consumer.service.js";
import { ProcessorModule } from "../processor/processor.module.js";

@Module({
  imports: [ProcessorModule],
  providers: [NotificationConsumerService],
})
export class ConsumerModule {}
