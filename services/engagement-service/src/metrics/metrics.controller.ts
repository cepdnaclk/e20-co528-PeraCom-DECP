import { Controller, Get, Res } from "@nestjs/common";
import { PrometheusController } from "@willsoto/nestjs-prometheus";
import type { Response } from "express";

@Controller("metrics")
export class MetricsController extends PrometheusController {
  @Get()
  async index(@Res({ passthrough: true }) response: Response) {
    // This super.index() call automatically fetches the CPU, RAM, and Node.js stats
    return super.index(response);
  }
}
