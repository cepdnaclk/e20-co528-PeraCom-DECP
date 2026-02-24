import { Injectable } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/validateEnv.config.js";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log("✅ Prisma connected to the database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log("🛑 Prisma disconnected");
  }
}
