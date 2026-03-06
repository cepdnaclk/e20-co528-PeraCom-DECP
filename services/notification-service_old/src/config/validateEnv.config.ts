import * as dotenv from "dotenv";
dotenv.config();

function getValidatedEnv() {
  const requiredVars = ["NODE_PORT", "KAFKA_BROKER", "MONGO_URI"] as const;
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    NODE_PORT: parseInt(process.env.NODE_PORT as string, 10),
    KAFKA_BROKER: process.env.KAFKA_BROKER as string,
    MONGO_URI: process.env.MONGO_URI as string,
  };
}

export const env = getValidatedEnv();
