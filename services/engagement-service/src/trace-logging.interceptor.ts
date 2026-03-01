import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { trace, context } from "@opentelemetry/api";

@Injectable()
export class TraceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    // 1. Grab the Trace ID from OpenTelemetry
    const activeSpan = trace.getSpan(context.active());
    const traceId = activeSpan?.spanContext().traceId || "no-trace";

    // 2. Grab the Correlation ID from Kong (assuming Kong passes it in the header)
    // Adjust the header name if Kong uses something else like 'correlation-id'
    const correlationId =
      req.headers["x-correlation-id"] || req.correlationId || "no-correlation";

    const now = Date.now();

    // 3. Let the request finish, then log the result with the IDs attached
    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(
          `[TraceID: ${traceId}] [CorrID: ${correlationId}] ${method} ${url} ${res.statusCode} - ${delay}ms`,
        );
      }),
    );
  }
}
