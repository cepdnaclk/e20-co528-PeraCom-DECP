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

@Module({
  imports: [
    // Loads the environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => env],
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
      },
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: env.MONGO_URI,
      }),
    }),

    HealthModule,
    MetricsModule,
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AppModule implements NestModule {
  configure(consumers: MiddlewareConsumer) {
    consumers.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
