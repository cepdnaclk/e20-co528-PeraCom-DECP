import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from "@nestjs/terminus";
import { context, trace } from "@opentelemetry/api";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Controller()
export class HealthController {
  constructor(
    @InjectPinoLogger(HealthController.name)
    private readonly logger: PinoLogger,

    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
  ) {}

  // Liveness
  @Get("health")
  getHealth() {
    // 1. Grab the giant "backpack" (Context)
    const activeContext = context.active();

    // 2. Pull out the current active "Span" from the backpack
    const activeSpan = trace.getSpan(activeContext);

    // 3. Read the traceId from the span (with a fallback just in case)
    const traceId = activeSpan?.spanContext().traceId || "no-active-trace";

    this.logger.info({ traceId }, "Received health check request");

    return {
      status: "UP",
      service: "engagement-service",
      traceId: traceId,
      timestamp: new Date(),
    };
  }

  // Readiness
  @Get("ready")
  @HealthCheck()
  check() {
    this.logger.info("Performing readiness check");
    return this.health.check([async () => this.mongoose.pingCheck("mongodb")]);
  }
}
