import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { makeCounterProvider } from "@willsoto/nestjs-prometheus";
import { CommentsController } from "./comments.controller.js";
import { CommentsService } from "./comments.service.js";
import { Comment, CommentSchema } from "./schemas/comment.schema.js";
import { Post, PostSchema } from "../posts/schemas/post.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    makeCounterProvider({
      name: "engagement_comments_total",
      help: "Total number of comments operations",
    }),
  ],
})
export class CommentsModule {}
