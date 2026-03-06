import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, type MessageDocument } from "./schemas/message.schema.js";
import {
  Conversation,
  type ConversationDocument,
} from "../conversations/schemas/conversation.schema.js";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  // ========================================================================
  // SAVE MESSAGE (With Idempotency & Inbox Update)
  // ========================================================================
  async processNewMessage(
    senderId: string,
    conversationId: string,
    clientMessageId: string,
    content: string,
  ) {
    let savedMessage: MessageDocument;

    try {
      // 1. Attempt to save the message
      const newMessage = new this.messageModel({
        clientMessageId,
        conversationId: new Types.ObjectId(conversationId),
        senderId,
        content,
      });
      savedMessage = await newMessage.save();
    } catch (error: any) {
      // 🛡️ THE IDEMPOTENCY SHIELD
      if (error.code === 11000) {
        this.logger.warn(
          `Idempotent retry detected for message ${clientMessageId}`,
        );
        // The message is already in the DB. Fetch it and return it as if it just succeeded.
        const existingMessage = await this.messageModel
          .findOne({ clientMessageId })
          .exec();
        if (!existingMessage)
          throw new InternalServerErrorException("Failed to recover message");
        savedMessage = existingMessage;
      } else {
        throw error;
      }
    }

    // 2. Update the Conversation Inbox details
    // We do this asynchronously (fire-and-forget) so we don't block the WebSocket response
    const snippet = content ? content.substring(0, 50) : "Attachment";

    const updatedConversation = await this.conversationModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(conversationId) },
        {
          $set: {
            lastMessageSnippet: snippet,
            lastMessageSenderId: senderId,
            lastMessageAt: savedMessage.createdAt,
          },
        },
        { new: true }, // Return the updated document so we can see the participants
      )
      .lean()
      .exec();

    return {
      savedMessage,
      participants: updatedConversation?.participants || [],
    };
  }
}
