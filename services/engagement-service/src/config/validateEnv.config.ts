import * as dotenv from "dotenv";
dotenv.config();

function getValidatedEnv() {
  if (process.env.ENVIRONMENT === "build") {
    console.log("Skipping environment validation for build phase...");
    return {} as any;
  }

  // 1. Define strictly what is required to boot the app
  const requiredVars = [
    "JWT_SECRET",
    "KAFKA_BROKER",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "MONGO_URI",
    "LOG_LEVEL",
  ] as const;
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.log("Current OS Env Keys:", Object.keys(process.env));
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
    LOG_LEVEL: process.env.LOG_LEVEL as string,
  };
}

// 3. Execute this ONCE when the file is loaded, and export the resulting object.
export const env = getValidatedEnv();
