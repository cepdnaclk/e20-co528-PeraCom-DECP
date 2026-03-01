import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { makeCounterProvider } from "@willsoto/nestjs-prometheus";
import { PostsController } from "./posts.controller.js";
import { PostsService } from "./posts.service.js";
import { Post, PostSchema } from "./schemas/post.schema.js";
import { MinioService } from "../minio/minio.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    MinioService,
    makeCounterProvider({
      name: "engagement_posts_created_total",
      help: "Total number of posts created",
    }),
  ],
})
export class PostsModule {}
