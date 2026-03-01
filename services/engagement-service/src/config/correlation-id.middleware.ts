import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { v7 as uuidv7 } from "uuid";

// We extend the Express Request interface to tell TypeScript about our new property
export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction) {
    // 1. Try to get it from Kong, or generate a fallback if testing locally
    const correlationId =
      (req.headers["x-correlation-id"] as string) || uuidv7();

    // 2. Attach it to the request object so our Controllers can read it
    req.correlationId = correlationId;

    // 3. Attach it to the outgoing response so the frontend knows the tracking number
    res.setHeader("x-correlation-id", correlationId);

    // 4. Pass control to the next step in NestJS
    next();
  }
}
