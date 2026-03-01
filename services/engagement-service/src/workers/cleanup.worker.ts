import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Comment,
  type CommentDocument,
} from "../comments/schemas/comment.schema.js";
import {
  Reaction,
  type ReactionDocument,
} from "../reaction/schemas/reaction.schema.js";

@Injectable()
export class CleanupWorker {
  // NestJS's built-in logger is great for background workers!
  private readonly logger = new Logger(CleanupWorker.name);

  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
  ) {}

  /**
   * 🎧 This function LISTENS for the 'engagement.post.deleted' event from your Event Bus.
   * Note: The exact decorator here depends on your event bus setup.
   * If you use NestJS Microservices with Kafka, it would be @EventPattern('engagement.post.deleted')
   */
  async handlePostDeletedEvent(eventPayload: any) {
    // 1. Extract the post ID from the event data you sent in PostsService
    const postIdString = eventPayload.data.post_id;
    const postId = new Types.ObjectId(postIdString);

    this.logger.log(
      `🧹 Janitor starting cleanup for deleted Post ID: ${postIdString}`,
    );

    try {
      // 2. Delete all reactions attached to this post
      const reactionResult = await this.reactionModel
        .deleteMany({ postId })
        .exec();
      this.logger.log(
        `✅ Swept up ${reactionResult.deletedCount} orphaned reactions.`,
      );

      // 3. Delete all comments attached to this post
      const commentResult = await this.commentModel
        .deleteMany({ postId })
        .exec();
      this.logger.log(
        `✅ Swept up ${commentResult.deletedCount} orphaned comments.`,
      );
    } catch (error) {
      // If the database has a hiccup, we log it, but the user's app doesn't crash
      // because this is happening in the background!
      this.logger.error(
        `❌ Janitor failed to clean up Post ID: ${postIdString}`,
        error,
      );
    }
  }
}
