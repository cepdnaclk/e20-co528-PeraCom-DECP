import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import type { Connection, Model } from "mongoose";
import { Comment, type CommentDocument } from "./schemas/comment.schema.js";
import { Post, type PostDocument } from "../posts/schemas/post.schema.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus/dist/injector.js";
import type { Counter } from "prom-client";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import type { CreateCommentDto, UpdateCommentDto } from "./dto/comment.dto.js";
import { env } from "../config/validateEnv.config.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class CommentsService {
  constructor(
    @InjectPinoLogger(CommentsService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,

    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectConnection() private readonly connection: Connection,

    @InjectMetric("engagement_comments_total")
    private commentCounter: Counter<string>,
  ) {}

  // =================================================
  // Add a Comment
  // =================================================
  async addComment(
    actorId: string,
    correlationId: string,
    payload: CreateCommentDto,
  ) {
    // 1. Destructure the payload
    const { postId, content } = payload;
    this.logger.info(
      `[TraceID: ${correlationId}] Attempting to add comment to post ${postId} by user ${actorId}`,
    );

    // 2. Start a database session and transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 3. Ensure the post exists before commenting
      const postExists = await this.postModel
        .exists({ _id: postId })
        .session(session);
      if (!postExists) throw new NotFoundException("Post not found");

      // 4. Create the comment
      const [newComment] = await this.commentModel.create(
        [
          {
            postId: new Types.ObjectId(postId),
            authorId: actorId,
            content: content.trim(),
          },
        ],
        { session },
      );

      if (!newComment) {
        throw new Error("Failed to create comment");
      }

      // 5. Atomically add +1 to the Post's commentCount
      const updatedPost = await this.postModel.findByIdAndUpdate(
        postId,
        { $inc: { commentCount: 1 } },
        { session, new: true },
      );

      if (!updatedPost) {
        throw new NotFoundException("Post not found during update");
      }

      // 6. Commit all database changes safely
      await session.commitTransaction();

      // 7. Track Metrics & Emit Event
      this.commentCounter.inc();

      // 8. Emit an event to the event bus for other services to consume
      const commentEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.comment.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: postId,
          comment_id: newComment._id,
        },
      };

      publishEvent("engagement.events", commentEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, postId },
          "Failed to publish comment created event",
        ),
      );

      // 9. Return the newly created comment
      return newComment;
    } catch (error) {
      // 10. Rollback the entire transaction if ANY step fails
      this.logger.error(
        { err: error, correlationId, postId },
        "Error occurred while adding comment, rolling back transaction",
      );
      await session.abortTransaction();
      throw error;
    } finally {
      // 11. Always close the session to prevent memory leaks
      await session.endSession();
    }
  }

  // =================================================
  // Get Comments for a Post (Cursor Pagination)
  // =================================================
  async getCommentsByPostId(
    actorId: string,
    correlationId: string,
    postId: string,
    cursor?: string,
    limit: number = 10,
  ) {
    // 1. Validate postId and cursor
    if (!Types.ObjectId.isValid(postId))
      throw new BadRequestException("Invalid post ID");

    // 2. Enforce a maximum limit to prevent abuse
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const filter: any = { postId: new Types.ObjectId(postId) };

    // 3. If a cursor is provided, we only want comments with _id < cursor (for descending order)
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor))
        throw new BadRequestException("Invalid cursor");
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    // 4. The +1 Limit Trick for cursor pagination
    const comments = await this.commentModel
      .find(filter)
      .sort({ _id: -1 }) // Newest comments first
      .limit(safeLimit + 1)
      .lean()
      .exec();

    // 5. Determine the next cursor
    let nextCursor = null;

    if (comments.length > safeLimit) {
      comments.pop(); // Remove the extra comment we fetched for the cursor check
      nextCursor = comments[comments.length - 1]?._id.toString();
    }

    // 7 Increment Prometheus metric for comments retrieval
    this.commentCounter.inc();

    // 8. Emit an event or log for further processing
    const commentsViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.comments.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        post_id: postId,
        cursor: cursor ?? null,
        limit: safeLimit,
        comments_retrieved: comments.length,
      },
    };

    publishEvent("engagement.events", commentsViewedEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, postId },
        "Failed to publish comments viewed event",
      ),
    );

    // 9. Return the comments along with the next cursor for pagination
    return {
      data: comments,
      nextCursor,
    };
  }

  // =================================================
  // Delete a Comment BY Owner
  // =================================================
  async deleteCommentByOwner(
    actorId: string,
    correlationId: string,
    commentId: string,
  ) {
    // 1. Validate the comment ID
    if (!Types.ObjectId.isValid(commentId))
      throw new BadRequestException("Invalid comment ID");

    // 2. Start the database session and transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 3. Fetch the comment to check ownership
      const deletedComment = await this.commentModel
        .findOneAndDelete({ _id: commentId, authorId: actorId }, { session })
        .exec();

      if (!deletedComment)
        throw new NotFoundException(
          "Comment not found or you do not have permission.",
        );

      // 4. Atomically subtract -1 from the Post's commentCount
      await this.postModel.findByIdAndUpdate(
        deletedComment.postId,
        { $inc: { commentCount: -1 } },
        { session },
      );

      // 5. Commit all database changes safely
      await session.commitTransaction();

      // 6. Increment Prometheus metric for comment deletion
      this.commentCounter.inc();

      // 7. Emit Event
      const deleteEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.comment.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: deletedComment.postId.toString(),
          comment_id: deletedComment._id.toString(),
          deleted_by_admin: false,
        },
      };

      publishEvent("engagement.events", deleteEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, postId: deletedComment.postId },
          "Failed to publish comment deleted event",
        ),
      );

      // 7. Return success response
      return { success: true, message: "Comment deleted successfully" };
    } catch (error) {
      // 8. Rollback the entire transaction if ANY step fails
      this.logger.error(
        { err: error, correlationId, commentId },
        "Error occurred while deleting comment, rolling back transaction",
      );
      await session.abortTransaction();
      throw error;
    } finally {
      // 9. Always close the session to prevent memory leaks
      await session.endSession();
    }
  }

  // =================================================
  // Delete a Comment BY Admin
  // =================================================
  async deleteCommentByAdmin(
    actorId: string,
    correlationId: string,
    commentId: string,
  ) {
    // 1. Validate the comment ID
    if (!Types.ObjectId.isValid(commentId))
      throw new BadRequestException("Invalid comment ID");

    // 2. Start the database session and transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 3. Fetch the comment to check ownership
      const deletedComment = await this.commentModel
        .findOneAndDelete({ _id: commentId }, { session })
        .exec();

      if (!deletedComment)
        throw new NotFoundException(
          "Comment not found or you do not have permission.",
        );

      // 4. Atomically subtract -1 from the Post's commentCount
      await this.postModel.findByIdAndUpdate(
        deletedComment.postId,
        { $inc: { commentCount: -1 } },
        { session },
      );

      // 5. Commit all database changes safely
      await session.commitTransaction();

      // 6. Increment Prometheus metric for comment deletion
      this.commentCounter.inc();

      // 7. Emit Event
      const deleteEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.comment.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: deletedComment.postId.toString(),
          comment_id: deletedComment._id.toString(),
          deleted_by_admin: true,
        },
      };

      publishEvent("engagement.events", deleteEvent).catch((err) =>
        this.logger.error(
          { err, correlationId, postId: deletedComment.postId },
          "Failed to publish comment deleted event",
        ),
      );

      // 7. Return success response
      return { success: true, message: "Comment deleted successfully" };
    } catch (error) {
      // 8. Rollback the entire transaction if ANY step fails
      this.logger.error(
        { err: error, correlationId, commentId },
        "Error occurred while deleting comment, rolling back transaction",
      );
      await session.abortTransaction();
      throw error;
    } finally {
      // 9. Always close the session to prevent memory leaks
      await session.endSession();
    }
  }

  // =================================================
  // Update a Comment
  // =================================================
  async updateComment(
    actorId: string,
    correlationId: string,
    payload: UpdateCommentDto,
  ) {
    // 1. Destructure the payload
    const { commentId, content } = payload;

    // 2. Fetch the comment to verify ownership and creation time
    const existingComment = await this.commentModel.findOne({
      _id: commentId,
      authorId: actorId,
    });

    if (!existingComment) {
      throw new NotFoundException(
        "Comment not found or you do not have permission",
      );
    }

    // 3. Enforce the 1-hour time limit
    // Assumes your Mongoose schema has { timestamps: true } enabled
    const ONE_HOUR_MS = env.EDIT_POST_TIME_LIMIT_MINUTES * 60 * 1000;
    const commentAgeMs = Date.now() - existingComment.createdAt.getTime();

    if (commentAgeMs > ONE_HOUR_MS) {
      throw new ForbiddenException(
        "Comments can only be edited within 1 hour of posting",
      );
    }

    // 4. Apply updates to the document in memory
    existingComment.content = content.trim();

    // Note: Ensure `isEdited` is defined in your Comment schema!
    existingComment.isEdited = true;

    // 5. The OCC Save Try/Catch
    let updatedComment: CommentDocument;
    try {
      // Because optimisticConcurrency: true is enabled on the schema,
      // Mongoose checks if the version (__v) in the DB matches the one we fetched.
      // If it matches, it saves and increments __v. If not, it throws a VersionError.
      updatedComment = await existingComment.save();
    } catch (error) {
      if ((error as Error).name === "VersionError") {
        this.logger.warn(
          { correlationId, commentId },
          "Concurrency conflict detected while updating comment",
        );
        // Return a 409 Conflict so the frontend knows to refresh the data
        throw new ConflictException(
          "Comment was updated by another request. Please try again.",
        );
      }
      throw error;
    }

    // 6. Increment Prometheus metric for comment updates
    this.commentCounter.inc();

    // 7. Emit Event
    const updateEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.comment.updated",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        post_id: updatedComment.postId.toString(),
        comment_id: updatedComment._id.toString(),
        is_edited: true,
      },
    };

    publishEvent("engagement.events", updateEvent).catch((err) =>
      this.logger.error(
        { err, correlationId, postId: updatedComment.postId },
        "Failed to publish comment updated event",
      ),
    );

    // 8. Return the updated comment
    return updatedComment;
  }
}
