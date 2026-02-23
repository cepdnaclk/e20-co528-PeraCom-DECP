import { Injectable } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "../generated/prisma-client/client.js";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    console.log("✅ Prisma connected to the database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log("🛑 Prisma disconnected");
  }
}
