import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { connectProducer } from "@decp/event-bus";
import { env } from "./config/validateEnv.config.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Initialize the Kafka shared event bus connection
  await connectProducer([env.KAFKA_BROKER]);

  // 2. Allow Prisma to disconnect gracefully when the app stops
  app.enableShutdownHooks();

  await app.listen(env.NODE_PORT);
}

bootstrap();
