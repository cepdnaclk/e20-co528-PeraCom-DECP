import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Post, type PostDocument } from "./schemas/post.schema.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Counter } from "prom-client";
import { v7 as uuidv7 } from "uuid";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { MinioService } from "../minio/minio.service.js";
import { env } from "../config/validateEnv.config.js";
import type {
  CreatePostDto,
  RepostDto,
  UpdatePostDto,
} from "./dto/post.dto.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class PostsService {
  constructor(
    @InjectPinoLogger(PostsService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,

    private readonly minioService: MinioService,

    @InjectMetric("engagement_posts_created_total")
    private postCounter: Counter<string>,
  ) {}

  // =================================================
  // Post Retrieval with Pagination
  // =================================================
  async getPostById(
    actorId: string,
    correlationId: string,
    postId: string,
  ): Promise<Post> {
    // 1. Validate postId format
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException("Invalid post ID");
    }
    this.logger.info({ correlationId, postId }, "Fetching post by ID");

    // 2. Fetch post from database
    const post = await this.postModel.findById(postId).lean().exec();

    // 3. Handle not found case
    if (!post) throw new NotFoundException("Post not found!");

    // 4. Increment Prometheus metric
    this.postCounter.inc();

    // 5. Emit an event or log for further processing
    const viewEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.post.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        post_id: post._id,
      },
    };

    publishEvent("engagement.post.viewed", viewEvent).catch((err) => {
      this.logger.error(
        { err, correlationId, postId: post._id },
        "Failed to publish view event",
      );
    });

    // 6. Return post data
    return post;
  }

  // =================================================
  // Cursor-based pagination for post listing
  // =================================================
  async getFeed(
    actorId: string,
    correlationId: string,
    cursor?: string,
    limit: number = 10,
  ) {
    // 1. Protect the database from massive queries
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    // 2. Build query filter from cursor
    let filter = {};

    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        throw new BadRequestException("Invalid cursor");
      }

      // Fetch posts older (less than) the ID of the last post they saw
      filter = {
        _id: { $lt: new Types.ObjectId(cursor) },
      };
    }

    // 3. Fetch posts from database
    const posts = await this.postModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(safeLimit + 1) // Fetch one extra to check if there's a next page
      .lean() // ✨ Maximum read performance
      .exec();

    // 4. Determine next cursor for pagination
    const nextCursor =
      posts.length > safeLimit
        ? String(posts[posts.length - 2]?._id ?? "")
        : null;

    // 5. Increment Prometheus metric
    this.postCounter.inc();

    // 6. Emit an event or log for further processing
    const feedViewedEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.feed.viewed",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        cursor: cursor ?? null,
        limit: safeLimit,
        result_count: posts.length,
        next_cursor: nextCursor,
      },
    };

    publishEvent("engagement.events", feedViewedEvent).catch((err) => {
      this.logger.error(
        { err, correlationId },
        "Failed to publish feed viewed event",
      );
    });

    // 7. Return feed payload
    return {
      data: posts,
      nextCursor,
    };
  }

  // =================================================
  // Post Creation with Media Handling
  // =================================================
  async createPost(
    userId: string,
    correlationId: string,
    dto: CreatePostDto,
    files: Express.Multer.File[] = [],
  ) {
    // 1. Validate media attachments
    let images: string[] = [];
    let video: string | null = null;
    this.logger.info(
      { correlationId, userId, fileCount: files.length },
      "Creating post with media attachments",
    );

    // ✨ Track uploaded object names so we know exactly what to delete if something fails
    const uploadedObjectNames: string[] = [];

    // 2. Enforce media rules
    const imageFiles = files.filter((file) =>
      file.mimetype.startsWith("image/"),
    );

    const videoFiles = files.filter((file) =>
      file.mimetype.startsWith("video/"),
    );

    // 3. Enforce rules
    // Rule 1: Cannot have both
    if (imageFiles.length > 0 && videoFiles.length > 0) {
      throw new BadRequestException("Cannot upload both images and video");
    }

    // Rule 2: Max 10 images
    if (imageFiles.length > 10) {
      throw new BadRequestException("Maximum 10 images allowed");
    }

    // Rule 3: Max 1 video
    if (videoFiles.length > 1) {
      throw new BadRequestException("Only 1 video allowed");
    }

    try {
      // 4. Upload images
      for (const file of imageFiles) {
        const objectName = `posts/${Date.now()}-${file.originalname}`;
        const url = await this.minioService.uploadFile(
          "posts-bucket",
          objectName,
          file.buffer,
          file.mimetype,
        );
        images.push(url);
        uploadedObjectNames.push(objectName);
      }

      // 5. Upload video
      if (videoFiles.length === 1) {
        const file = videoFiles[0];
        if (!file) {
          throw new BadRequestException("Invalid video file");
        }

        const objectName = `posts/${Date.now()}-${file.originalname}`;
        video = await this.minioService.uploadFile(
          "posts-bucket",
          objectName,
          file.buffer,
          file.mimetype,
        );
        uploadedObjectNames.push(objectName);
      }
    } catch (error) {
      this.logger.error(
        { err: error, correlationId, userId },
        "Error occurred during media upload, rolling back any uploaded files",
      );

      for (const objectName of uploadedObjectNames) {
        await this.minioService
          .deleteFile("posts-bucket", objectName)
          .catch((err) =>
            this.logger.error(
              { err, correlationId, objectName },
              "Failed to rollback uploaded file",
            ),
          );
      }
      throw new BadRequestException("Failed to create post");
    }

    // 6. Create post document
    const createdPost = new this.postModel({
      ...dto,
      images,
      video,
      authorId: userId,
    });

    try {
      // 7. Save to database
      const savedPost = await createdPost.save();

      // 8. Increment Prometheus counter
      this.postCounter.inc();

      // 9. Emit an event or log for further processing
      const postCreatedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.post.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: userId,
        data: {
          post_id: savedPost.id,
        },
      };

      publishEvent("engagement.events", postCreatedEvent).catch((err) => {
        this.logger.error(
          { err, correlationId, postId: savedPost.id },
          "Failed to publish post created event",
        );
      });

      // 10. Return the created post
      return savedPost;
    } catch (dbError) {
      this.logger.error(
        { err: dbError, correlationId, userId },
        "Database error occurred while creating post, rolling back uploaded media",
      );

      for (const objectName of uploadedObjectNames) {
        await this.minioService
          .deleteFile("posts-bucket", objectName)
          .catch((err) =>
            this.logger.error(
              { err, correlationId, objectName },
              "Failed to rollback uploaded file after DB error",
            ),
          );
      }

      throw dbError;
    }
  }

  // =================================================
  // Update Post by Owner (within 1 hour of creation)
  // =================================================
  async updatePost(
    actorId: string,
    correlationId: string,
    payload: UpdatePostDto,
    files: Express.Multer.File[] = [],
  ): Promise<Post> {
    const { postId, content } = payload;

    // 1. Validate postId format
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException("Invalid post ID");
    }
    this.logger.info(
      { correlationId, actorId, postId, fileCount: files.length },
      "Updating post with potential media changes",
    );

    // 2. Fetch the post to verify ownership and edit window
    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException("Post not found");

    // 3. Strict ownership check
    if (post.authorId !== actorId) {
      console.warn(
        `[CorrID: ${correlationId}] SECURITY: User ${actorId} attempted to update post ${postId} owned by ${post.authorId}`,
      );
      throw new ForbiddenException(
        "You do not have permission to update this post",
      );
    }

    // 4. Enforce 1-hour edit window
    const createdAt = post.createdAt as Date;
    const elapsed = Date.now() - createdAt.getTime();
    if (elapsed > env.EDIT_POST_TIME_LIMIT_MINUTES * 60 * 1000) {
      throw new ForbiddenException(
        "Posts can only be edited within 1 hour of creation",
      );
    }

    // Track state for our Rollback/Cleanup system
    const newlyUploadedObjects: string[] = [];
    const oldMediaToCleanup: string[] = [];

    // 5. Handle media replacement (if new files are provided)
    if (files.length > 0) {
      const imageFiles = files.filter((f) => f.mimetype.startsWith("image/"));
      const videoFiles = files.filter((f) => f.mimetype.startsWith("video/"));

      if (imageFiles.length > 0 && videoFiles.length > 0)
        throw new BadRequestException("Cannot upload both images and video");
      if (imageFiles.length > 10)
        throw new BadRequestException("Maximum 10 images allowed");
      if (videoFiles.length > 1)
        throw new BadRequestException("Only 1 video allowed");

      // Mark old media for deletion (we will delete these ONLY if the DB saves successfully)
      if (post.images?.length > 0) oldMediaToCleanup.push(...post.images);
      if (post.video) oldMediaToCleanup.push(post.video);

      // Upload new images
      if (imageFiles.length > 0) {
        const uploadedImages: string[] = [];
        for (const file of imageFiles) {
          const objectName = `posts/${Date.now()}-${file.originalname}`;
          const url = await this.minioService.uploadFile(
            "posts-bucket",
            objectName,
            file.buffer,
            file.mimetype,
          );
          uploadedImages.push(url);
          newlyUploadedObjects.push(objectName); // Track for potential rollback!
        }
        post.images = uploadedImages;
        post.video = null;
      }

      // Upload new video
      if (videoFiles.length === 1) {
        const file: any = videoFiles[0];
        const objectName = `posts/${Date.now()}-${file.originalname}`;
        const videoUrl = await this.minioService.uploadFile(
          "posts-bucket",
          objectName,
          file.buffer,
          file.mimetype,
        );

        post.video = videoUrl;
        post.images = [];
        newlyUploadedObjects.push(objectName); // Track for potential rollback!
      }
    }

    // 6. Apply content update (if provided)
    if (content !== undefined) post.content = content;

    if (content === undefined && files.length === 0) {
      throw new BadRequestException(
        "No updates provided. Supply content or media files.",
      );
    }

    post.isEdited = true; // Mark as edited

    // 7. 🔥 THE DANGER ZONE: Try to save the DB
    try {
      const updatedPost = await post.save();

      // SUCCESS! The DB is safe. Now we can cleanly delete their OLD files in the background.
      // (Assuming your MinioService has a deleteFile method)
      for (const oldUrl of oldMediaToCleanup) {
        // Extract the object name from your URL and delete it
        const objectName = oldUrl.split("/").slice(-2).join("/"); // basic extraction
        this.minioService
          .deleteFile("posts-bucket", objectName)
          .catch((err) =>
            this.logger.error(
              { err, correlationId, objectName },
              "Failed to delete old media file after post update",
            ),
          );
      }

      // 8. Increment Prometheus metric
      this.postCounter.inc();

      // 9. Emit event
      const postUpdatedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.post.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: postId,
          content_updated: content !== undefined,
          media_updated: files.length > 0,
        },
      };

      publishEvent("engagement.events", postUpdatedEvent).catch((err) => {
        this.logger.error(
          { err, correlationId },
          "Failed to publish post updated event",
        );
      });

      return updatedPost;
    } catch (error) {
      // 🚨 DISASTER AVERTED: The database failed to save!
      // We must rollback and delete the NEW files we just uploaded so they don't become zombies.
      this.logger.error(
        { correlationId },
        `[CorrID: ${correlationId}] DB Save failed! Rolling back Minio uploads...`,
      );
      for (const objectName of newlyUploadedObjects) {
        await this.minioService
          .deleteFile("posts-bucket", objectName)
          .catch((err) =>
            this.logger.error(
              { err, correlationId, objectName },
              "Failed to rollback uploaded Minio file",
            ),
          );
      }

      // Re-throw the error so NestJS returns a 500 or 400 to the user
      throw error;
    }
  }

  // =================================================
  // Delete Post by Owner
  // =================================================
  async deletePostByOwner(
    actorId: string,
    correlationId: string,
    postId: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Validate postId format
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException("Invalid post ID");
    }
    this.logger.info(
      { correlationId, actorId, postId },
      "Attempting to delete post by owner",
    );

    // 2. Fetch the post to verify ownership
    const deletedPost = await this.postModel
      .findOneAndDelete({ _id: postId, authorId: actorId })
      .exec();

    // 3. Ensure it exists
    if (!deletedPost) {
      throw new NotFoundException(
        "Post not found or you do not have permission.",
      );
    }

    // 4. Increment Prometheus metric
    this.postCounter.inc();

    // 5. Emit an event for further processing
    const deleteEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.post.deleted",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        post_id: postId,
        deleted_by_admin: false,
      },
    };

    publishEvent("engagement.events", deleteEvent).catch((err) => {
      this.logger.error(
        { err, correlationId },
        "Failed to publish post deleted event",
      );
    });

    // 6. Return success
    return {
      success: true,
      message: "Post successfully deleted",
    };
  }

  // =================================================
  // Delete Post as Admin
  // =================================================
  async deletePostAsAdmin(
    actorId: string,
    correlationId: string,
    postId: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Validate postId format
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException("Invalid post ID");
    }
    this.logger.info(
      { correlationId, actorId, postId },
      "Attempting to delete post as admin",
    );

    // 2. Fetch the post to capture metadata before deletion
    const deletedPost = await this.postModel
      .findOneAndDelete({ _id: postId })
      .exec();

    // 3. Ensure it exists
    if (!deletedPost) {
      throw new NotFoundException("Post not found");
    }

    // 4. Increment Prometheus metric
    this.postCounter.inc();

    // 5. Emit an event for further processing
    const deleteEvent: BaseEvent<any> = {
      eventId: uuidv7(),
      eventType: "engagement.post.deleted",
      eventVersion: "1.0",
      timestamp: new Date().toISOString(),
      producer: "engagement-service",
      correlationId: correlationId,
      actorId: actorId,
      data: {
        post_id: postId,
        deleted_by_admin: true,
      },
    };

    publishEvent("engagement.events", deleteEvent).catch((err) => {
      this.logger.error(
        { err, correlationId },
        "Failed to publish admin post deleted event",
      );
    });

    // 6. Return success
    return {
      success: true,
      message: "Post successfully deleted by admin",
    };
  }

  // =================================================
  // Create a Repost (Pure or Quote)
  // =================================================
  async repostPost(actorId: string, correlationId: string, payload: RepostDto) {
    const { originalPostId, content } = payload;

    // 1. Fetch the original post
    const originalPost = await this.postModel
      .findById(originalPostId)
      .lean()
      .exec();
    if (!originalPost) {
      throw new NotFoundException("Original post not found");
    }

    // ✨ THE "INCEPTION" PREVENTION ✨
    // If the user tries to repost a repost, we link their new post to the ROOT post.
    // This prevents deep nesting chains that break frontend UIs.
    const rootPostId = originalPost.originalPostId || originalPost._id;

    // 2. Idempotency Check (Only for "Pure" Reposts)
    // If they aren't adding content, they can only pure-repost once.
    const isQuote = content && content.trim().length > 0;

    if (!isQuote) {
      const existingPureRepost = await this.postModel.exists({
        authorId: actorId,
        originalPostId: rootPostId,
        content: { $exists: false }, // Check for a post with no content
      });

      if (existingPureRepost) {
        this.logger.warn(
          { correlationId, actorId, rootPostId },
          "User attempted to pure repost the same post multiple times",
        );
        return { success: true, message: "Already reposted" };
      }
    }

    try {
      // 3. Create the Repost Document
      const repostDoc = new this.postModel({
        authorId: actorId,
        originalPostId: rootPostId,
        content: isQuote ? content.trim() : undefined,
      });

      // 4. We MUST save this first to see if MongoDB rejects it
      const savedRepost = await repostDoc.save();

      // If we made it here, the save was successful!
      // 5. Now it is safe to atomically increment the parent's counter.
      await this.postModel.findByIdAndUpdate(rootPostId, {
        $inc: { repostCount: 1 },
      });

      // 6. Metrics & Events
      this.postCounter.inc(); // A repost is technically a new post creation!

      // 7. Emit an event for further processing
      const repostEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.post.reposted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          new_post_id: savedRepost._id.toString(),
          original_post_id: rootPostId.toString(),
          is_quote: isQuote,
        },
      };

      publishEvent("engagement.events", repostEvent).catch((err) =>
        this.logger.error(
          { err, correlationId },
          "Failed to publish post reposted event",
        ),
      );

      return savedRepost;
    } catch (error) {
      //✨ IDEMPOTENCY CATCH ✨
      // If they double-clicked a pure repost, MongoDB blocks the second one.
      if ((error as any)?.code === 11000) {
        return { success: true, message: "Already reposted" };
      }
      throw error; // Throw real database crashes
    }
  }
}
