import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationType,
  type ConversationDocument,
} from "./schemas/conversation.schema.js";
import {
  Message,
  type MessageDocument,
} from "../messages/schemas/message.schema.js";
import { CreateConversationDto } from "./dto/conversation.dto.js";

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,

    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  // ========================================================================
  // CREATE CONVERSATION (With Idempotent DM Lookup)
  // ========================================================================
  async createConversation(actorId: string, dto: CreateConversationDto) {
    // 1. Prepare the full participant list (Creator + Invitees)
    // We use a Set to ensure no duplicate IDs are passed
    const uniqueParticipants = Array.from(
      new Set([actorId, ...dto.participantIds]),
    );

    if (
      dto.type === ConversationType.DIRECT &&
      uniqueParticipants.length !== 2
    ) {
      throw new BadRequestException(
        "Direct messages must have exactly 2 unique participants.",
      );
    }

    // 2. 🛡️ IDEMPOTENCY SHIELD FOR DIRECT MESSAGES
    // If it's a DM, check if these two users already have an active chat.
    if (dto.type === ConversationType.DIRECT) {
      const existingDm = await this.conversationModel
        .findOne({
          type: ConversationType.DIRECT,
          // Match a document where the participants array contains EXACTLY these two users
          "participants.userId": { $all: uniqueParticipants },
          participants: { $size: 2 },
        })
        .exec();

      // If a chat already exists, just return it! Do not create a duplicate.
      if (existingDm) return existingDm;
    }

    // 3. Create the new conversation
    const newConversation = new this.conversationModel({
      type: dto.type,
      title: dto.type === ConversationType.GROUP ? dto.title : undefined,
      createdBy: actorId,
      participants: uniqueParticipants.map((id) => ({ userId: id })),
      lastMessageAt: new Date(), // Set initial sort date
    });

    return await newConversation.save();
  }

  // ========================================================================
  // GET USER INBOX (The lightweight UI load)
  // ========================================================================
  async getUserInbox(actorId: string) {
    // We only need ONE query to load the entire inbox perfectly sorted!
    const inbox = await this.conversationModel
      .find({
        "participants.userId": actorId,
      })
      .sort({ lastMessageAt: -1 }) // Newest active chats at the top
      .lean()
      .exec();

    // The frontend will map over this array.
    // If it's a DIRECT chat, the frontend will filter out the `actorId`
    // from the participants array and fetch the OTHER user's name/avatar to display.
    return inbox;
  }

  // ========================================================================
  // GET CHAT HISTORY (Strict Cursor Pagination)
  // ========================================================================
  async getConversationHistory(
    actorId: string,
    conversationId: string,
    cursorId?: string,
    limit: number = 50,
  ) {
    if (!Types.ObjectId.isValid(conversationId))
      throw new BadRequestException("Invalid conversation ID");

    // 1. Security Check: Is this user actually in this chat?
    const conversation = await this.conversationModel.exists({
      _id: new Types.ObjectId(conversationId),
      "participants.userId": actorId,
    });

    if (!conversation) {
      throw new ForbiddenException(
        "You do not have access to this conversation.",
      );
    }

    // 2. Build the Cursor Query
    const query: any = { conversationId: new Types.ObjectId(conversationId) };

    if (cursorId) {
      if (!Types.ObjectId.isValid(cursorId))
        throw new BadRequestException("Invalid cursor ID format");
      // Give me messages that are OLDER (smaller ID) than the oldest message I currently see
      query._id = { $lt: new Types.ObjectId(cursorId) };
    }

    // 3. Execute the O(1) Indexed Query
    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 }) // Fetch newest first (going backwards in time)
      .limit(limit)
      .lean()
      .exec();

    // 4. Resolve the Next Cursor
    let nextCursorId = null;
    if (messages.length === limit) {
      // The cursor for the next page is the _id of the LAST message in this batch
      nextCursorId = messages[messages.length - 1]?._id.toString();
    }

    return {
      data: messages,
      nextCursorId,
      // Note: The frontend usually reverses this array before rendering
      // so the oldest message is at the top of the screen.
    };
  }

  // ========================================================================
  // UPDATE READ WATERMARK (Double Blue Ticks)
  // ========================================================================
  async updateReadWatermark(
    actorId: string,
    conversationId: string,
    messageId: string,
  ) {
    if (
      !Types.ObjectId.isValid(conversationId) ||
      !Types.ObjectId.isValid(messageId)
    ) {
      throw new BadRequestException("Invalid ID format");
    }

    const readAt = new Date();

    // The positional operator `$` is the magic here.
    // It finds the exact participant in the array and updates ONLY their nested fields.
    const result = await this.conversationModel
      .updateOne(
        {
          _id: new Types.ObjectId(conversationId),
          "participants.userId": actorId,
        },
        {
          $set: {
            "participants.$.lastReadMessageId": new Types.ObjectId(messageId),
            "participants.$.lastReadAt": readAt,
          },
        },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new ForbiddenException(
        "You are not a participant in this conversation.",
      );
    }

    return { readAt };
  }
}
