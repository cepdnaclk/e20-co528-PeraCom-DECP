import { env } from "./config/validateEnv.config.js";
import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CorrelationIdMiddleware } from "./config/correlation-id.middleware.js";
import { RolesGuard } from "./auth/guards/roles.guard.js";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard.js";
import { JwtStrategy } from "./auth/strategies/jwt.strategy.js";
import { HealthModule } from "./health/health.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { LoggerModule } from "nestjs-pino";
import { MongooseModule } from "@nestjs/mongoose";
import { PostsModule } from "./posts/posts.module.js";
import { ReactionsModule } from "./reaction/reaction.module.js";
import { CommentsModule } from "./comments/comments.module.js";
import { WorkersModule } from "./workers/workers.module.js";

@Module({
  imports: [
    // Loads the environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => env],
    }),

    // Sets up structured logging with Pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        ...(env.ENVIRONMENT !== "production" && {
          transport: {
            target: "pino-pretty",
            options: {
              singleLine: true,
              colorize: true,
              levelFirst: true,
              translateTime: "SYS:standard",
            },
          },
        }),
      },
    }),

    // Connects to MongoDB using Mongoose
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: env.MONGO_URI,
      }),
    }),

    // Application modules
    HealthModule,
    MetricsModule,
    PostsModule,
    ReactionsModule,
    CommentsModule,
    WorkersModule,
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AppModule implements NestModule {
  configure(consumers: MiddlewareConsumer) {
    consumers.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
