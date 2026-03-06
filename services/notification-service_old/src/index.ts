import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { env } from "./config/validateEnv.config.js";
import { ValidationPipe } from "@nestjs/common/pipes/index.js";
import { startKafkaConsumer } from "./consumer/kafka.consumer.js";
import { NotificationService } from "./notification/notification.service.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const server = await app.listen(env.NODE_PORT);

  const notificationService = app.get(NotificationService);
  const shutdownConsumer = await startKafkaConsumer(notificationService);

  const gracefulShutdown = async () => {
    await shutdownConsumer();
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

bootstrap();
