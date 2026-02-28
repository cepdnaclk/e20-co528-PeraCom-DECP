import { Controller, Get } from "@nestjs/common";
import { context, trace } from "@opentelemetry/api"; // ✨ Import trace here!

@Controller()
export class HealthController {
  @Get("/health")
  health() {
    // 1. Grab the giant "backpack" (Context)
    const activeContext = context.active();

    // 2. Pull out the current active "Span" from the backpack
    const activeSpan = trace.getSpan(activeContext);

    // 3. Read the traceId from the span (with a fallback just in case)
    const traceId = activeSpan?.spanContext().traceId || "no-active-trace";

    console.log(`[TraceID: ${traceId}] -> Received health check request`);

    return {
      status: "ok",
      service: "identity-service",
      traceId: traceId,
      timestamp: new Date().toISOString(),
    };
  }
}
