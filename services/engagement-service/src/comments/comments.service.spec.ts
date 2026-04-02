import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken, getConnectionToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CommentsService } from "./comments.service.js";
import { Comment } from "./schemas/comment.schema.js";
import { Post } from "../posts/schemas/post.schema.js";
import {
  createMockConnection,
  createMockCounter,
  createMockLogger,
  createMockSession,
  createObjectId,
} from "../test/test-utils.js";
import { getLoggerToken } from "nestjs-pino";

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/validateEnv.config.js", () => ({
  env: { EDIT_POST_TIME_LIMIT_MINUTES: 60 },
}));

describe("CommentsService", () => {
  let service: CommentsService;
  let commentModel: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndDelete: jest.Mock;
  };
  let postModel: {
    exists: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let connection: { startSession: jest.Mock };
  let session: ReturnType<typeof createMockSession>;
  let commentCounter: ReturnType<typeof createMockCounter>;
  let logger: ReturnType<typeof createMockLogger>;

  const actorId = "user-123";
  const correlationId = "corr-456";

  beforeEach(async () => {
    session = createMockSession();
    connection = createMockConnection(session);
    commentCounter = createMockCounter();
    logger = createMockLogger();

    const mockCommentModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    };

    const mockPostModel = {
      exists: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(true),
      }),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getModelToken(Comment.name), useValue: mockCommentModel },
        { provide: getModelToken(Post.name), useValue: mockPostModel },
        { provide: getConnectionToken(), useValue: connection },
        { provide: "PROM_METRIC_ENGAGEMENT_COMMENTS_TOTAL", useValue: commentCounter },
        { provide: getLoggerToken(CommentsService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentModel = module.get(getModelToken(Comment.name));
    postModel = module.get(getModelToken(Post.name));

    jest.clearAllMocks();
  });

  describe("addComment", () => {
    const postId = createObjectId();
    const payload = { postId, content: "Test comment" };

    it("creates comment when post exists", async () => {
      const newComment = {
        _id: new Types.ObjectId(),
        postId: new Types.ObjectId(postId),
        authorId: actorId,
        content: "Test comment",
      };

      (postModel.exists as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(true),
      });
      (commentModel.create as jest.Mock).mockResolvedValue([newComment]);
      (postModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await service.addComment(actorId, correlationId, payload);

      expect(result).toEqual(newComment);
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
      expect(commentCounter.inc).toHaveBeenCalled();
    });

    it("throws NotFound when post does not exist", async () => {
      (postModel.exists as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.addComment(actorId, correlationId, payload),
      ).rejects.toThrow(NotFoundException);

      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it("aborts transaction and endSession on create failure", async () => {
      (postModel.exists as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(true),
      });
      (commentModel.create as jest.Mock).mockRejectedValue(new Error("DB error"));

      await expect(
        service.addComment(actorId, correlationId, payload),
      ).rejects.toThrow("DB error");

      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });
  });

  describe("getCommentsByPostId", () => {
    const postId = createObjectId();

    it("returns paginated comments with nextCursor", async () => {
      const comments = [
        { _id: new Types.ObjectId(), content: "c1" },
        { _id: new Types.ObjectId(), content: "c2" },
        { _id: new Types.ObjectId(), content: "c3" },
      ];

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(comments),
      };
      (commentModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getCommentsByPostId(
        actorId,
        correlationId,
        postId,
        undefined,
        10,
      );

      expect(result.data).toEqual(comments);
      expect(result.nextCursor).toBeNull();
      expect(commentCounter.inc).toHaveBeenCalled();
    });

    it("returns nextCursor when more comments exist", async () => {
      const comments = [
        { _id: new Types.ObjectId(), content: "c1" },
        { _id: new Types.ObjectId(), content: "c2" },
        { _id: new Types.ObjectId(), content: "c3" },
        { _id: new Types.ObjectId(), content: "c4" },
      ];
      const limit = 3;

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(comments),
      };
      (commentModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getCommentsByPostId(
        actorId,
        correlationId,
        postId,
        undefined,
        limit,
      );

      expect(result.data).toHaveLength(3);
      expect(result.nextCursor).toBe(comments[2]!._id.toString());
    });

    it("throws BadRequest for invalid postId", async () => {
      await expect(
        service.getCommentsByPostId(actorId, correlationId, "invalid-id"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest for invalid cursor", async () => {
      await expect(
        service.getCommentsByPostId(actorId, correlationId, postId, "bad-cursor"),
      ).rejects.toThrow(BadRequestException);
    });

    it("clamps limit between 1 and 50", async () => {
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      (commentModel.find as jest.Mock).mockReturnValue(findChain);

      await service.getCommentsByPostId(actorId, correlationId, postId, undefined, 100);
      expect(findChain.limit).toHaveBeenCalledWith(51);
    });
  });

  describe("deleteCommentByOwner", () => {
    const commentId = createObjectId();
    const deletedComment = {
      _id: new Types.ObjectId(commentId),
      postId: new Types.ObjectId(createObjectId()),
      authorId: actorId,
    };

    it("deletes when owner", async () => {
      (commentModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedComment),
      });
      (postModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await service.deleteCommentByOwner(
        actorId,
        correlationId,
        commentId,
      );

      expect(result).toEqual({ success: true, message: "Comment deleted successfully" });
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(commentCounter.inc).toHaveBeenCalled();
    });

    it("throws NotFound when not owner or missing", async () => {
      (commentModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deleteCommentByOwner(actorId, correlationId, commentId),
      ).rejects.toThrow(NotFoundException);

      expect(session.abortTransaction).toHaveBeenCalled();
    });

    it("throws BadRequest for invalid commentId", async () => {
      await expect(
        service.deleteCommentByOwner(actorId, correlationId, "invalid"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteCommentByAdmin", () => {
    const commentId = createObjectId();
    const deletedComment = {
      _id: new Types.ObjectId(commentId),
      postId: new Types.ObjectId(createObjectId()),
      authorId: "other-user",
    };

    it("deletes any comment", async () => {
      (commentModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedComment),
      });
      (postModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await service.deleteCommentByAdmin(
        actorId,
        correlationId,
        commentId,
      );

      expect(result).toEqual({ success: true, message: "Comment deleted successfully" });
      expect(commentModel.findOneAndDelete).toHaveBeenCalledWith(
        { _id: commentId },
        { session },
      );
    });

    it("throws BadRequest for invalid commentId", async () => {
      await expect(
        service.deleteCommentByAdmin(actorId, correlationId, "invalid"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateComment", () => {
    const commentId = createObjectId();
    const payload = { commentId, content: "Updated content" };

    it("updates when owner and within 1 hour", async () => {
      const savedComment = {
        _id: new Types.ObjectId(commentId),
        postId: new Types.ObjectId(createObjectId()),
        content: "Updated content",
        isEdited: true,
      };
      const existingComment = {
        _id: new Types.ObjectId(commentId),
        postId: new Types.ObjectId(createObjectId()),
        authorId: actorId,
        content: "Original",
        isEdited: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        save: jest.fn().mockResolvedValue(savedComment),
      };

      (commentModel.findOne as jest.Mock).mockResolvedValue(existingComment);

      const result = await service.updateComment(actorId, correlationId, payload);

      expect(existingComment.save).toHaveBeenCalled();
      expect(result).toEqual(savedComment);
      expect(commentCounter.inc).toHaveBeenCalled();
    });

    it("throws NotFound when not owner", async () => {
      (commentModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateComment(actorId, correlationId, payload),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws Forbidden when comment is older than 1 hour", async () => {
      const oldComment = {
        _id: new Types.ObjectId(commentId),
        authorId: actorId,
        content: "Old",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };

      (commentModel.findOne as jest.Mock).mockResolvedValue(oldComment);

      await expect(
        service.updateComment(actorId, correlationId, payload),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws Conflict on VersionError", async () => {
      const existingComment = {
        _id: new Types.ObjectId(commentId),
        authorId: actorId,
        content: "Original",
        isEdited: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        save: jest.fn().mockRejectedValue({ name: "VersionError" }),
      };

      (commentModel.findOne as jest.Mock).mockResolvedValue(existingComment);

      await expect(
        service.updateComment(actorId, correlationId, payload),
      ).rejects.toThrow(ConflictException);
    });
  });
});
