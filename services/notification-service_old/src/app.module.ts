import { env } from "./config/validateEnv.config.js";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ConsumerModule } from "./consumer/consumer.module.js";
import { NotificationModule } from "./notification/notification.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => env],
    }),
    MongooseModule.forRoot(env.MONGO_URI),
    ConsumerModule,
    NotificationModule,
  ],
})
export class AppModule {}
