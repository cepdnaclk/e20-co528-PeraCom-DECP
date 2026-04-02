import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { NotFoundException } from "@nestjs/common";
import { ReactionsService } from "./reaction.service.js";
import { Reaction } from "./schemas/reaction.schema.js";
import { Post, ReactionType } from "../posts/schemas/post.schema.js";
import { createMockCounter, createMockLogger, createObjectId } from "../test/test-utils.js";
import { getLoggerToken } from "nestjs-pino";

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("ReactionsService", () => {
  let service: ReactionsService;
  let reactionModel: {
    findOne: jest.Mock;
    deleteOne: jest.Mock;
    create: jest.Mock;
  };
  let postModel: {
    exists: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let reactionCounter: ReturnType<typeof createMockCounter>;
  let logger: ReturnType<typeof createMockLogger>;

  const actorId = "user-123";
  const correlationId = "corr-456";

  beforeEach(async () => {
    reactionCounter = createMockCounter();
    logger = createMockLogger();

    const mockReactionModel = {
      findOne: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      create: jest.fn().mockResolvedValue({}),
    };

    const mockPostModel = {
      exists: jest.fn().mockResolvedValue(true),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        { provide: getModelToken(Reaction.name), useValue: mockReactionModel },
        { provide: getModelToken(Post.name), useValue: mockPostModel },
        { provide: "PROM_METRIC_ENGAGEMENT_REACTIONS_TOTAL", useValue: reactionCounter },
        { provide: getLoggerToken(ReactionsService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<ReactionsService>(ReactionsService);
    reactionModel = module.get(getModelToken(Reaction.name));
    postModel = module.get(getModelToken(Post.name));

    jest.clearAllMocks();
  });

  describe("reactToPost", () => {
    const postId = createObjectId();

    describe("Scenario A: Same reaction - remove", () => {
      it("removes reaction when user toggles same type", async () => {
        const existingReaction = {
          _id: new Types.ObjectId(),
          postId: new Types.ObjectId(postId),
          userId: actorId,
          type: ReactionType.LIKE,
        };

        reactionModel.findOne.mockResolvedValue(existingReaction);

        const result = await service.reactToPost(actorId, correlationId, {
          postId,
          reactionType: ReactionType.LIKE,
        });

        expect(result).toEqual({ success: true, message: "Reaction removed" });
        expect(reactionModel.deleteOne).toHaveBeenCalledWith({
          _id: existingReaction._id,
        });
        expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
          postId,
          expect.objectContaining({
            $inc: {
              totalReactions: -1,
              "reactionCounts.LIKE": -1,
            },
          }),
        );
        expect(reactionCounter.inc).toHaveBeenCalledWith({
          reaction_type: ReactionType.LIKE,
        });
      });
    });

    describe("Scenario B: Switch reaction", () => {
      it("updates when user switches type (e.g. LIKE -> HAHA)", async () => {
        const existingReaction = {
          _id: new Types.ObjectId(),
          postId: new Types.ObjectId(postId),
          userId: actorId,
          type: ReactionType.LIKE,
          save: jest.fn().mockResolvedValue({}),
        };

        reactionModel.findOne.mockResolvedValue(existingReaction);

        const result = await service.reactToPost(actorId, correlationId, {
          postId,
          reactionType: ReactionType.HAHA,
        });

        expect(result).toEqual({ success: true, message: "Reaction updated" });
        expect(existingReaction.type).toBe(ReactionType.HAHA);
        expect(existingReaction.save).toHaveBeenCalled();
        expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
          postId,
          expect.objectContaining({
            $inc: {
              "reactionCounts.LIKE": -1,
              "reactionCounts.HAHA": 1,
            },
          }),
        );
      });
    });

    describe("Scenario C: New reaction", () => {
      it("adds reaction when none exists", async () => {
        reactionModel.findOne.mockResolvedValue(null);

        const result = await service.reactToPost(actorId, correlationId, {
          postId,
          reactionType: ReactionType.LOVE,
        });

        expect(result).toEqual({ success: true, message: "Reaction added" });
        expect(reactionModel.create).toHaveBeenCalledWith({
          postId: new Types.ObjectId(postId),
          userId: actorId,
          type: ReactionType.LOVE,
        });
        expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
          postId,
          expect.objectContaining({
            $inc: {
              totalReactions: 1,
              "reactionCounts.LOVE": 1,
            },
          }),
        );
      });

      it("throws NotFound when post is missing", async () => {
        reactionModel.findOne.mockResolvedValue(null);
        postModel.exists.mockResolvedValue(null);

        await expect(
          service.reactToPost(actorId, correlationId, {
            postId,
            reactionType: ReactionType.LIKE,
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("Concurrency", () => {
      it("handles 11000 duplicate key and returns success", async () => {
        const dupKeyError = new Error("Duplicate key");
        (dupKeyError as any).code = 11000;
        reactionModel.findOne.mockResolvedValue(null);
        reactionModel.create.mockRejectedValue(dupKeyError);

        const result = await service.reactToPost(actorId, correlationId, {
          postId,
          reactionType: ReactionType.LIKE,
        });

        expect(result).toEqual({ success: true, message: "Reaction already added" });
      });
    });
  });
});
