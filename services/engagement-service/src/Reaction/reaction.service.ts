import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Reaction, type ReactionDocument } from "./schemas/reaction.schema.js";
import { Post, type PostDocument } from "../posts/schemas/post.schema.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus/dist/injector.js";
import type { Counter } from "prom-client";
import { publishEvent, type BaseEvent } from "@decp/event-bus";
import { v7 as uuidv7 } from "uuid";
import type { CreateReactionDto } from "./dto/create-reaction.dto.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class ReactionsService {
  constructor(
    @InjectPinoLogger(ReactionsService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,

    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,

    @InjectMetric("engagement_reactions_total")
    private reactionCounter: Counter<string>,
  ) {}

  // =================================================
  // React a Post (Idempotent)
  // =================================================
  async reactToPost(
    actorId: string,
    correlationId: string,
    payload: CreateReactionDto,
  ) {
    // Destructure the payload
    const { postId, reactionType } = payload;

    // Check if the user ALREADY has a reaction on this post
    const existingReaction = await this.reactionModel.findOne({
      postId: new Types.ObjectId(postId),
      userId: actorId,
    });

    // Increment Prometheus counter
    this.reactionCounter.inc({ reaction_type: reactionType });

    // SCENARIO A: The user already reacted with the EXACT SAME reaction.
    // Remove the reaction. It's idempotent.
    if (existingReaction && existingReaction.type === reactionType) {
      // 1. Delete the existing reaction document
      await this.reactionModel.deleteOne({ _id: existingReaction._id });

      // 2. Atomically update the post's counters: -1 from total, and -1 from the specific reaction type
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: {
          totalReactions: -1,
          [`reactionCounts.${reactionType}`]: -1,
        },
      });

      // 3. Emit "reaction.deleted" event
      const deletedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.reaction.deleted",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: postId,
          reaction_type: reactionType,
        },
      };

      publishEvent("engagement.events", deletedEvent).catch((err) => {
        this.logger.error(
          { err, correlationId, postId },
          "Failed to publish reaction deleted event",
        );
      });

      // 4. Return success message
      return { success: true, message: "Reaction removed" };
    }

    // SCENARIO B: The user is SWITCHING their reaction (e.g., LIKE -> HAHA)
    if (existingReaction && existingReaction.type !== reactionType) {
      const oldType = existingReaction.type;

      // 1. Update the reaction document to the new type
      existingReaction.type = reactionType;
      await existingReaction.save();

      // 2. Atomically update the post's counters
      // We subtract 1 from the old type, and add 1 to the new type!
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: {
          [`reactionCounts.${oldType}`]: -1,
          [`reactionCounts.${reactionType}`]: 1,
        },
      });

      // 3. Emit "reaction.updated"
      const reactionEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.reaction.updated",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: postId,
          old_reaction: oldType,
          new_reaction: reactionType,
        },
      };

      publishEvent("engagement.events", reactionEvent).catch((err) => {
        this.logger.error(
          { err, correlationId, postId },
          "Failed to publish reaction updated event",
        );
      });

      // 4. Return success message
      return { success: true, message: "Reaction updated" };
    }

    // SCENARIO C: The user has NEVER reacted to this post before.
    // 1. Ensure post exists before creating a new reaction
    try {
      const postExists = await this.postModel.exists({ _id: postId });
      if (!postExists) throw new NotFoundException("Post not found");

      // 2. Create the new reaction
      await this.reactionModel.create({
        postId: new Types.ObjectId(postId),
        userId: actorId,
        type: reactionType,
      });

      // 3. Atomically add +1 to the total count, AND +1 to the specific reaction count
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: {
          totalReactions: 1,
          [`reactionCounts.${reactionType}`]: 1,
        },
      });

      // 4. Emit "reaction.created" event
      const reactionCreatedEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "engagement.reaction.created",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "engagement-service",
        correlationId: correlationId,
        actorId: actorId,
        data: {
          post_id: postId,
          reaction_type: reactionType,
        },
      };

      publishEvent("engagement.events", reactionCreatedEvent).catch((err) => {
        this.logger.error(
          { err, correlationId, postId },
          "Failed to publish reaction created event",
        );
      });

      // 6. Return success message
      return { success: true, message: "Reaction added" };
    } catch (error) {
      // ✨ THE CONCURRENCY FIX ✨
      // If two requests try to create the reaction at the exact same millisecond,
      // MongoDB's unique compound index will block the second one and throw error 11000.
      // We catch it and return success so the frontend doesn't crash.
      if (error instanceof Error && (error as any).code === 11000) {
        return { success: true, message: "Reaction already added" };
      }

      // If it is a real database failure (like a connection timeout), we re-throw it
      throw error;
    }
  }
}
