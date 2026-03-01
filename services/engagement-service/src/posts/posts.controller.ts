import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  Param,
  Get,
  Delete,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { PostsService } from "./posts.service.js";
import { CreatePostDto, UpdatePostDto } from "./dto/post.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { ActorId } from "../auth/decorators/actor.decorator.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";
import multer from "multer";
import { env } from "../config/validateEnv.config.js";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // POST /posts
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor("media", 10, {
      limits: {
        fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, // 20MB limit
      },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype.startsWith("image/") ||
          file.mimetype.startsWith("video/")
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Only image or video allowed"), false);
        }
      },
    }),
  )
  async create(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postsService.createPost(
      actorId,
      correlationId,
      createPostDto,
      files,
    );
  }

  // GET /posts/:id
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getPost(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") postId: string,
  ) {
    return this.postsService.getPostById(actorId, correlationId, postId);
  }

  // GET /posts?cursor=xxx&limit=10
  @UseGuards(JwtAuthGuard)
  @Get()
  async getFeed(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe)
    limit?: number,
  ) {
    return this.postsService.getFeed(actorId, correlationId, cursor, limit);
  }

  // PATCH /posts
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor("media", 10, {
      limits: {
        fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype.startsWith("image/") ||
          file.mimetype.startsWith("video/")
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Only image or video allowed"), false);
        }
      },
    }),
  )
  async updatePost(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Body() payload: UpdatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postsService.updatePost(actorId, correlationId, payload, files);
  }

  // DELETE /posts/admin/:id — Admin deletes any post
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete("admin/:id")
  async deletePostAsAdmin(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") postId: string,
  ) {
    return this.postsService.deletePostAsAdmin(actorId, correlationId, postId);
  }

  // DELETE /posts/:id — Owner deletes their own post
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async deletePost(
    @ActorId() actorId: string,
    @CorrelationId() correlationId: string,
    @Param("id") postId: string,
  ) {
    return this.postsService.deletePostByOwner(actorId, correlationId, postId);
  }
}
