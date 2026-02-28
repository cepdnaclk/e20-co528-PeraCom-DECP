import { otelSDK } from "./tracing.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { connectProducer } from "@decp/event-bus";
import { env } from "./config/validateEnv.config.js";
import { ValidationPipe } from "@nestjs/common/pipes/index.js";
import { TraceLoggingInterceptor } from "./trace-logging.interceptor.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Start the OpenTelemetry SDK
  otelSDK.start();

  // 2. Initialize the Kafka shared event bus connection
  await connectProducer([env.KAFKA_BROKER]);

  // 3. Allow Prisma to disconnect gracefully when the app stops
  app.enableShutdownHooks();

  // 4. The security shield
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. The trace logging interceptor
  app.useGlobalInterceptors(new TraceLoggingInterceptor());

  await app.listen(env.NODE_PORT);
}

bootstrap();
