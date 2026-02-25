import { env } from "./config/validateEnv.config.js";
import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CorrelationIdMiddleware } from "./config/correlation-id.middleware.js";
import { AuthModule } from "./auth/auth.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { PresenceModule } from "./presence/presence.module.js";
import { UsersModule } from "./users/users.module.js";
import { SocialModule } from "./social-media/social.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ExperienceModule } from "./experience/experience.module.js";
import { EducationModule } from "./education/education.module.js";

@Module({
  imports: [
    // Loads the environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => env],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    PresenceModule,
    UsersModule,
    SocialModule,
    ProjectsModule,
    ExperienceModule,
    EducationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumers: MiddlewareConsumer) {
    consumers.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
