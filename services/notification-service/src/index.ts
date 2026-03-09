import { otelSDK } from "./tracing.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { env } from "./config/validateEnv.config.js";
import { ValidationPipe } from "@nestjs/common";
import { TraceLoggingInterceptor } from "./trace-logging.interceptor.js";
import { Logger } from "nestjs-pino";

async function bootstrap() {
  // 1. Start the OpenTelemetry SDK
  otelSDK.start();

  // 2. Create the NestJS application with log buffering enabled
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // 3. Use the Pino logger for structured logging
  app.useLogger(app.get(Logger));

  // 4. Allow Prisma to disconnect gracefully when the app stops
  app.enableShutdownHooks();

  // 5. The security shield
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 6. The trace logging interceptor
  app.useGlobalInterceptors(new TraceLoggingInterceptor());

  // 7. Start the application
  await app.listen(env.NODE_PORT);
}

bootstrap();
