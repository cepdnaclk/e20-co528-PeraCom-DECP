import { defineConfig } from "prisma/config";
import { env } from "./src/config/validateEnv.config.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env.DATABASE_URL,
  },
});
