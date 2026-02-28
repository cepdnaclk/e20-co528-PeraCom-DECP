import { env } from "./config/validateEnv.config.js";
import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CorrelationIdMiddleware } from "./config/correlation-id.middleware.js";
import { RolesGuard } from "./auth/guards/roles.guard.js";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard.js";
import { JwtStrategy } from "./auth/strategies/jwt.strategy.js";
import { HealthModule } from "./health/health.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";

@Module({
  imports: [
    // Loads the environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => env],
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
