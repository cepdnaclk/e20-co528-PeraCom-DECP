import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CommentsService } from "./comments.service.js";
import { CreateCommentDto, UpdateCommentDto } from "./dto/comment.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";

@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // POST /comments
  @UseGuards(JwtAuthGuard)
  @Post()
  async createComment(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.addComment(
      actorId,
      correlationId,
      createCommentDto,
    );
  }

  // GET /comments/post/:postId?cursor=xxx&limit=10
  @UseGuards(JwtAuthGuard)
  @Get(":postId")
  async getCommentsByPostId(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("postId") postId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return this.commentsService.getCommentsByPostId(
      actorId,
      correlationId,
      postId,
      cursor,
      limit,
    );
  }

  // PATCH /comments
  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateComment(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(actorId, correlationId, payload);
  }

  // DELETE /comments/admin/:commentId
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete("admin/:commentId")
  async deleteCommentByAdmin(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("commentId") commentId: string,
  ) {
    return this.commentsService.deleteCommentByAdmin(
      actorId,
      correlationId,
      commentId,
    );
  }

  // DELETE /comments/:commentId
  @UseGuards(JwtAuthGuard)
  @Delete(":commentId")
  async deleteCommentByOwner(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("commentId") commentId: string,
  ) {
    return this.commentsService.deleteCommentByOwner(
      actorId,
      correlationId,
      commentId,
    );
  }
}
