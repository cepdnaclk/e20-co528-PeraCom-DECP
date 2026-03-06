import { Module } from "@nestjs/common";
import {
  makeCounterProvider,
  PrometheusModule,
} from "@willsoto/nestjs-prometheus";

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
    }),
  ],

  providers: [
    makeCounterProvider({
      name: "message_service_requests_total",
      help: "Total HTTP requests",
    }),
  ],

  exports: [],
})
export class MetricsModule {}
