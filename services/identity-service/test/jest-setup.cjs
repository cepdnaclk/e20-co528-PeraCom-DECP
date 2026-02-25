/**
 * Jest setup - runs before each test file.
 * Sets env vars so validateEnv.config does not throw when modules load.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-google-secret";
process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost/callback";
process.env.KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";
process.env.REDIS_HOST = process.env.REDIS_HOST || "localhost";
process.env.REDIS_PORT = process.env.REDIS_PORT || "6379";
process.env.TTL_SECONDS = process.env.TTL_SECONDS || "300";
process.env.NODE_PORT = process.env.NODE_PORT || "3000";
