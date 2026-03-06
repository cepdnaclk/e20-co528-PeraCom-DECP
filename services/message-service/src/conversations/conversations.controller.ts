import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service.js";
import { CreateConversationDto } from "./dto/conversation.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // POST /conversations
  @UseGuards(JwtAuthGuard)
  @Post()
  async createConversation(
    @ActorId() actorId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(actorId, dto);
  }

  // GET /conversations
  @UseGuards(JwtAuthGuard)
  @Get()
  async getInbox(@ActorId() actorId: string) {
    return this.conversationsService.getUserInbox(actorId);
  }

  // GET /conversations/:id/messages?cursorId=&limit=
  @UseGuards(JwtAuthGuard)
  @Get(":id/messages")
  async getHistory(
    @ActorId() actorId: string,
    @Param("id") conversationId: string,
    @Query("cursorId") cursorId?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = Math.min(Math.max(parsedLimit, 1), 100); // Hard cap at 100 per request

    return this.conversationsService.getConversationHistory(
      actorId,
      conversationId,
      cursorId,
      safeLimit,
    );
  }
}
