import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { env } from "./config/validateEnv.config.js";

const traceExporter = new OTLPTraceExporter({
  url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

const resource = resourceFromAttributes({
  "service.name": "collaboration-service",
  "service.version": "1.0.0",
  "deployment.environment": env.ENVIRONMENT || "development",
});

export const otelSDK = new NodeSDK({
  resource,
  traceExporter: traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// Graceful shutdown
process.on("SIGTERM", () => {
  otelSDK
    .shutdown()
    .then(() => console.log("🛑 Tracing terminated"))
    .catch((error) => console.log("🛑 Error terminating tracing", error))
    .finally(() => process.exit(0));
});
