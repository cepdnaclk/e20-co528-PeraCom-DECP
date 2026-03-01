import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CleanupWorker } from "./cleanup.worker.js";
import { Comment, CommentSchema } from "../comments/schemas/comment.schema.js";
import { Reaction, ReactionSchema } from "../reaction/schemas/reaction.schema.js";

@Module({
  imports: [
    // ✨ This gives the worker permission to talk to these specific database collections!
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Reaction.name, schema: ReactionSchema },
    ]),
  ],
  providers: [CleanupWorker],
})
export class WorkersModule {}