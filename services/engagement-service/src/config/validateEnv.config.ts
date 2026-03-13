import * as dotenv from "dotenv";
dotenv.config();

import { pino } from "pino";

const bootLogger = pino({
  name: "EnvValidator",
  ...(process.env.ENVIRONMENT !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, singleLine: true },
    },
  }),
});

function getValidatedEnv() {
  // 1. Define strictly what is required to boot the app
  const requiredVars = [
    "ENVIRONMENT",
    "JWT_SECRET",
    "KAFKA_BROKER",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "MONGO_URI",
    "SERVICE_NAME",
    "MINIO_ENDPOINT",
    "MINIO_PORT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
    "MINIO_BUCKET_NAME",
    "EDIT_POST_TIME_LIMIT_MINUTES",
    "MAX_FILE_SIZE_MB",
    "MAX_ALLOWED_FILES",
  ] as const;

  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    bootLogger.fatal({ missing }, "Missing required environment variables");

    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // 2. Return the guaranteed values
  return {
    // This stops TypeScript from complaining about `string | undefined`.
    ENVIRONMENT: process.env.ENVIRONMENT as string,
    NODE_PORT: parseInt(process.env.NODE_PORT as string, 10),
    KAFKA_BROKER: process.env.KAFKA_BROKER as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env
      .OTEL_EXPORTER_OTLP_ENDPOINT as string,
    MONGO_URI: process.env.MONGO_URI as string,
    SERVICE_NAME: process.env.SERVICE_NAME as string,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT as string,
    MINIO_PORT: process.env.MINIO_PORT as string,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY as string,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY as string,
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL as string,
    MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME as string,
    EDIT_POST_TIME_LIMIT_MINUTES: parseInt(
      process.env.EDIT_POST_TIME_LIMIT_MINUTES as string,
      10,
    ),
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB as string, 10),
    MAX_ALLOWED_FILES: parseInt(process.env.MAX_ALLOWED_FILES as string, 10),
  };
}

// 3. Execute this ONCE when the file is loaded, and export the resulting object.
export const env = getValidatedEnv();
