import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PostsService } from "./posts.service.js";
import { Post } from "./schemas/post.schema.js";
import { MinioService } from "../minio/minio.service.js";
import { createMockCounter, createMockLogger, createObjectId } from "../test/test-utils.js";
import { getLoggerToken } from "nestjs-pino";

jest.mock("@decp/event-bus", () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/validateEnv.config.js", () => ({
  env: { EDIT_POST_TIME_LIMIT_MINUTES: 60 },
}));

describe("PostsService", () => {
  let service: PostsService;
  let postModel: {
    findById: jest.Mock;
    find: jest.Mock;
    findOneAndDelete: jest.Mock;
    exists: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    mockSave?: jest.Mock;
  };
  let minioService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };
  let postCounter: ReturnType<typeof createMockCounter>;
  let logger: ReturnType<typeof createMockLogger>;

  const actorId = "user-123";
  const correlationId = "corr-456";

  beforeEach(async () => {
    postCounter = createMockCounter();
    logger = createMockLogger();
    minioService = {
      uploadFile: jest.fn().mockResolvedValue("https://minio.example.com/posts-bucket/obj"),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const createMockPostInstance = (doc: any) => ({
      ...doc,
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        ...doc,
        id: new Types.ObjectId().toString(),
      }),
    });

    const MockPostModel = jest.fn().mockImplementation(createMockPostInstance) as any;
    MockPostModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      exec: jest.fn().mockResolvedValue(null),
    });
    MockPostModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    MockPostModel.findOneAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    MockPostModel.exists = jest.fn().mockResolvedValue(null);
    MockPostModel.findByIdAndUpdate = jest.fn().mockResolvedValue({});

    const mockPostModel = MockPostModel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getModelToken(Post.name), useValue: mockPostModel },
        { provide: MinioService, useValue: minioService },
        { provide: "PROM_METRIC_ENGAGEMENT_POSTS_CREATED_TOTAL", useValue: postCounter },
        { provide: getLoggerToken(PostsService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postModel = module.get(getModelToken(Post.name));

    jest.clearAllMocks();
  });

  describe("getPostById", () => {
    const postId = createObjectId();
    const mockPost = { _id: new Types.ObjectId(postId), content: "Test post" };

    it("returns post when found", async () => {
      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPost),
        }),
      });

      const result = await service.getPostById(actorId, correlationId, postId);
      expect(result).toEqual(mockPost);
      expect(postCounter.inc).toHaveBeenCalled();
    });

    it("throws BadRequest on invalid postId", async () => {
      await expect(
        service.getPostById(actorId, correlationId, "invalid"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFound when post is missing", async () => {
      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.getPostById(actorId, correlationId, postId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getFeed", () => {
    const postId = createObjectId();

    it("returns paginated posts with nextCursor", async () => {
      const posts = [
        { _id: new Types.ObjectId(), content: "p1" },
        { _id: new Types.ObjectId(), content: "p2" },
      ];
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(posts),
      };
      (postModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getFeed(actorId, correlationId, undefined, 10);
      expect(result.data).toEqual(posts);
      expect(result.nextCursor).toBeNull();
      expect(postCounter.inc).toHaveBeenCalled();
    });

    it("throws BadRequest for invalid cursor", async () => {
      await expect(
        service.getFeed(actorId, correlationId, "bad-cursor"),
      ).rejects.toThrow(BadRequestException);
    });

    it("clamps limit between 1 and 50", async () => {
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      (postModel.find as jest.Mock).mockReturnValue(findChain);

      await service.getFeed(actorId, correlationId, undefined, 100);
      expect(findChain.limit).toHaveBeenCalledWith(51);
    });
  });

  describe("createPost", () => {
    const dto = { content: "New post content" };

    it("creates text-only post", async () => {
      const savedPost = {
        _id: new Types.ObjectId(),
        ...dto,
        authorId: actorId,
        images: [],
        video: null,
        id: new Types.ObjectId().toString(),
      };
      const mockSave = jest.fn().mockResolvedValue(savedPost);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.createPost(actorId, correlationId, dto, []);

      expect(result).toEqual(savedPost);
      expect(postCounter.inc).toHaveBeenCalled();
      expect(minioService.uploadFile).not.toHaveBeenCalled();
    });

    it("throws when both images and video", async () => {
      const imageFile = {
        buffer: Buffer.from("img"),
        mimetype: "image/png",
        originalname: "img.png",
      } as Express.Multer.File;
      const videoFile = {
        buffer: Buffer.from("vid"),
        mimetype: "video/mp4",
        originalname: "vid.mp4",
      } as Express.Multer.File;

      await expect(
        service.createPost(actorId, correlationId, dto, [
          imageFile,
          videoFile,
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when more than 10 images", async () => {
      const files = Array(11)
        .fill(null)
        .map((_, i) => ({
          buffer: Buffer.from("img"),
          mimetype: "image/png",
          originalname: `img${i}.png`,
        })) as Express.Multer.File[];

      await expect(
        service.createPost(actorId, correlationId, dto, files),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when more than 1 video", async () => {
      const files = [
        { buffer: Buffer.from("v1"), mimetype: "video/mp4", originalname: "v1.mp4" },
        { buffer: Buffer.from("v2"), mimetype: "video/mp4", originalname: "v2.mp4" },
      ] as Express.Multer.File[];

      await expect(
        service.createPost(actorId, correlationId, dto, files),
      ).rejects.toThrow(BadRequestException);
    });

    it("uploads images and creates post", async () => {
      const imageFile = {
        buffer: Buffer.from("img"),
        mimetype: "image/png",
        originalname: "img.png",
      } as Express.Multer.File;
      const savedPost = {
        _id: new Types.ObjectId(),
        ...dto,
        authorId: actorId,
        images: ["https://minio.example.com/posts-bucket/obj"],
        video: null,
        id: new Types.ObjectId().toString(),
      };
      const mockSave = jest.fn().mockResolvedValue(savedPost);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.createPost(actorId, correlationId, dto, [
        imageFile,
      ]);

      expect(minioService.uploadFile).toHaveBeenCalledWith(
        "posts-bucket",
        expect.stringContaining("posts/"),
        imageFile.buffer,
        "image/png",
      );
      expect(result).toEqual(savedPost);
    });
  });

  describe("updatePost", () => {
    const postId = createObjectId();
    const payload = { postId, content: "Updated content" };

    it("updates when owner and within 1 hour", async () => {
      const existingPost = {
        _id: new Types.ObjectId(postId),
        authorId: actorId,
        content: "Original",
        images: [],
        video: null,
        isEdited: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        save: jest.fn().mockResolvedValue({ ...payload, isEdited: true }),
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPost),
      });

      const result = await service.updatePost(actorId, correlationId, payload, []);

      expect(result).toBeDefined();
      expect(existingPost.save).toHaveBeenCalled();
      expect(postCounter.inc).toHaveBeenCalled();
    });

    it("throws Forbidden when not owner", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const existingPost = {
        _id: new Types.ObjectId(postId),
        authorId: "other-user",
        content: "Original",
        createdAt: new Date(),
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPost),
      });

      await expect(
        service.updatePost(actorId, correlationId, payload, []),
      ).rejects.toThrow(ForbiddenException);
      warnSpy.mockRestore();
    });

    it("throws Forbidden when post is older than 1 hour", async () => {
      const existingPost = {
        _id: new Types.ObjectId(postId),
        authorId: actorId,
        content: "Original",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPost),
      });

      await expect(
        service.updatePost(actorId, correlationId, payload, []),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequest when no updates provided", async () => {
      const existingPost = {
        _id: new Types.ObjectId(postId),
        authorId: actorId,
        content: "Original",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPost),
      });

      await expect(
        service.updatePost(actorId, correlationId, { postId }, []),
      ).rejects.toThrow(BadRequestException);
    });

    it("rolls back Minio uploads on DB save failure", async () => {
      const imageFile = {
        buffer: Buffer.from("img"),
        mimetype: "image/png",
        originalname: "img.png",
      } as Express.Multer.File;
      minioService.uploadFile.mockResolvedValue(
        "https://minio.example.com/posts-bucket/posts/123-img.png",
      );

      const existingPost = {
        _id: new Types.ObjectId(postId),
        authorId: actorId,
        content: "Original",
        images: [],
        video: null,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        save: jest.fn().mockRejectedValue(new Error("DB error")),
      };
      Object.defineProperty(existingPost, "images", {
        set: jest.fn(),
        get: () => [],
        configurable: true,
      });
      Object.defineProperty(existingPost, "video", {
        set: jest.fn(),
        get: () => null,
        configurable: true,
      });

      (postModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingPost),
      });

      await expect(
        service.updatePost(actorId, correlationId, payload, [imageFile]),
      ).rejects.toThrow("DB error");

      expect(minioService.deleteFile).toHaveBeenCalled();
    });
  });

  describe("deletePostByOwner", () => {
    const postId = createObjectId();

    it("deletes when owner", async () => {
      const deletedPost = {
        _id: new Types.ObjectId(postId),
        authorId: actorId,
      };
      (postModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedPost),
      });

      const result = await service.deletePostByOwner(actorId, correlationId, postId);

      expect(result).toEqual({
        success: true,
        message: "Post successfully deleted",
      });
      expect(postCounter.inc).toHaveBeenCalled();
    });

    it("throws NotFound when not owner", async () => {
      (postModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deletePostByOwner(actorId, correlationId, postId),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequest for invalid postId", async () => {
      await expect(
        service.deletePostByOwner(actorId, correlationId, "invalid"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deletePostAsAdmin", () => {
    const postId = createObjectId();

    it("deletes any post", async () => {
      const deletedPost = {
        _id: new Types.ObjectId(postId),
        authorId: "other-user",
      };
      (postModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedPost),
      });

      const result = await service.deletePostAsAdmin(actorId, correlationId, postId);

      expect(result).toEqual({
        success: true,
        message: "Post successfully deleted by admin",
      });
      expect(postModel.findOneAndDelete).toHaveBeenCalledWith({ _id: postId });
    });

    it("throws NotFound when post missing", async () => {
      (postModel.findOneAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deletePostAsAdmin(actorId, correlationId, postId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("repostPost", () => {
    const originalPostId = createObjectId();
    const rootPostId = new Types.ObjectId(originalPostId);

    it("creates pure repost", async () => {
      const originalPost = {
        _id: rootPostId,
        authorId: "other",
        content: "Original",
      };
      const savedRepost = {
        _id: new Types.ObjectId(),
        authorId: actorId,
        originalPostId: rootPostId,
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(originalPost),
        }),
      });
      (postModel.exists as jest.Mock).mockResolvedValue(null);
      const mockSave = jest.fn().mockResolvedValue(savedRepost);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.repostPost(actorId, correlationId, {
        originalPostId,
      });

      expect(result).toEqual(savedRepost);
      expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
        rootPostId,
        { $inc: { repostCount: 1 } },
      );
      expect(postCounter.inc).toHaveBeenCalled();
    });

    it("creates quote repost", async () => {
      const originalPost = {
        _id: rootPostId,
        authorId: "other",
        content: "Original",
      };
      const savedRepost = {
        _id: new Types.ObjectId(),
        authorId: actorId,
        originalPostId: rootPostId,
        content: "My take on this",
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(originalPost),
        }),
      });
      const mockSave = jest.fn().mockResolvedValue(savedRepost);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.repostPost(actorId, correlationId, {
        originalPostId,
        content: "My take on this",
      });

      expect(result).toEqual(savedRepost);
    });

    it("returns Already reposted for duplicate pure repost", async () => {
      const originalPost = {
        _id: rootPostId,
        authorId: "other",
        content: "Original",
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(originalPost),
        }),
      });
      (postModel.exists as jest.Mock).mockResolvedValue({});

      const result = await service.repostPost(actorId, correlationId, {
        originalPostId,
      });

      expect(result).toEqual({ success: true, message: "Already reposted" });
    });

    it("links repost-of-repost to root", async () => {
      const repostedPost = {
        _id: new Types.ObjectId(),
        authorId: "other",
        originalPostId: rootPostId,
        content: "First repost",
      };
      const savedRepost = {
        _id: new Types.ObjectId(),
        authorId: actorId,
        originalPostId: rootPostId,
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(repostedPost),
        }),
      });
      (postModel.exists as jest.Mock).mockResolvedValue(null);
      const mockSave = jest.fn().mockResolvedValue(savedRepost);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.repostPost(actorId, correlationId, {
        originalPostId: repostedPost._id.toString(),
      });

      expect(result.originalPostId).toEqual(rootPostId);
    });

    it("throws NotFound when original post missing", async () => {
      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.repostPost(actorId, correlationId, { originalPostId }),
      ).rejects.toThrow(NotFoundException);
    });

    it("handles 11000 duplicate key for pure repost", async () => {
      const originalPost = {
        _id: rootPostId,
        authorId: "other",
        content: "Original",
      };

      (postModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(originalPost),
        }),
      });
      (postModel.exists as jest.Mock).mockResolvedValue(null);
      const dupError = new Error("Duplicate");
      (dupError as any).code = 11000;
      const mockSave = jest.fn().mockRejectedValue(dupError);
      (postModel as any).mockImplementation((doc: any) => ({
        ...doc,
        save: mockSave,
      }));

      const result = await service.repostPost(actorId, correlationId, {
        originalPostId,
      });

      expect(result).toEqual({ success: true, message: "Already reposted" });
    });
  });
});
