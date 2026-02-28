import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller.js";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";

@Module({
  imports: [
    PrometheusModule.register({
      controller: MetricsController,
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class MetricsModule {}
