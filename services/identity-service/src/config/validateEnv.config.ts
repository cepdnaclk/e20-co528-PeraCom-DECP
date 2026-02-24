import * as dotenv from "dotenv";
dotenv.config();

function getValidatedEnv() {
  // 1. Define strictly what is required to boot the app
  const requiredVars = [
    "DATABASE_URL",
    "JWT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "REDIS_HOST",
    "REDIS_PORT",
    "TTL_SECONDS",
  ] as const;
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // 2. Return the guaranteed values
  return {
    // NODE_PORT is optional since it has a fallback, so it's not in requiredVars
    NODE_PORT: process.env.NODE_PORT || "3000",

    // This stops TypeScript from complaining about `string | undefined`.
    DATABASE_URL: process.env.DATABASE_URL as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
    REDIS_HOST: process.env.REDIS_HOST as string,
    REDIS_PORT: parseInt(process.env.REDIS_PORT as string, 10),
    TTL_SECONDS: parseInt(process.env.TTL_SECONDS as string, 10),
  };
}

// 3. Execute this ONCE when the file is loaded, and export the resulting object.
export const env = getValidatedEnv();
