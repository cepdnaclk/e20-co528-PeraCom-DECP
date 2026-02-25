/**
 * validateEnv runs at import time. Jest setup (jest-setup.ts) sets all required
 * process.env vars before tests run, so the import succeeds.
 */
import { env } from "./validateEnv.config.js";

describe("validateEnv.config", () => {
  it("should export env with all required keys when vars are set", () => {
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.JWT_SECRET).toBeDefined();
    expect(env.GOOGLE_CLIENT_ID).toBeDefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeDefined();
    expect(env.GOOGLE_CALLBACK_URL).toBeDefined();
    expect(env.KAFKA_BROKER).toBeDefined();
    expect(env.REDIS_HOST).toBeDefined();
    expect(env.REDIS_PORT).toBeDefined();
    expect(env.TTL_SECONDS).toBeDefined();
    expect(env.NODE_PORT).toBeDefined();
  });

  it("NODE_PORT, REDIS_PORT, TTL_SECONDS should be numbers", () => {
    expect(typeof env.NODE_PORT).toBe("number");
    expect(typeof env.REDIS_PORT).toBe("number");
    expect(typeof env.TTL_SECONDS).toBe("number");
  });
});
