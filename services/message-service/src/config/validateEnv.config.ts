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
    "JWT_SECRET",
    "KAFKA_BROKER",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "MONGO_URI",
    "MINIO_ENDPOINT",
    "MINIO_PORT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
    "ENVIRONMENT",
    "REDIS_URL",
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
    NODE_PORT: parseInt(process.env.NODE_PORT as string, 10),
    KAFKA_BROKER: process.env.KAFKA_BROKER as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env
      .OTEL_EXPORTER_OTLP_ENDPOINT as string,
    MONGO_URI: process.env.MONGO_URI as string,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT as string,
    MINIO_PORT: process.env.MINIO_PORT as string,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY as string,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY as string,
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL as string,
    ENVIRONMENT: process.env.ENVIRONMENT as string,
    REDIS_URL: process.env.REDIS_URL as string,
  };
}

// 3. Execute this ONCE when the file is loaded, and export the resulting object.
export const env = getValidatedEnv();
