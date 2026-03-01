import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ReactionsService } from "./reaction.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import { CreateReactionDto } from "./dto/create-reaction.dto.js";

@Controller("reactions")
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  // POST /reactions
  @UseGuards(JwtAuthGuard)
  @Post()
  async reactToPost(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: CreateReactionDto,
  ) {
    return this.reactionsService.reactToPost(actorId, correlationId, payload);
  }
}
