import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt"; // Or your custom Auth Service
import { ConversationsService } from "../conversations/conversations.service.js";
import { publishEvent } from "@decp/event-bus"; // Your Kafka publisher
import { v7 as uuidv7 } from "uuid";
import type { MessagesService } from "./messages.service.js";
import type { PresenceService } from "../presence/presence.service.js";
import { CorrelationId } from "../auth/decorators/correlation-id.decorator.js";

@WebSocketGateway({
  cors: {
    origin: "*", // Restrict this in production!
  },
  namespace: "/messaging", // Keeps chat traffic isolated from other potential WS features
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly presenceService: PresenceService, // For Redis presence tracking
  ) {}

  // ========================================================================
  // HANDLE CONNECTION (Auth & Room Assignment)
  // ========================================================================
  async handleConnection(client: Socket) {
    try {
      // 1. Extract the JWT from the handshake payload
      // Frontend should pass this like: const socket = io(url, { auth: { token: 'jwt...' }})
      const token = client.handshake.auth.token;
      if (!token) throw new Error("No token provided");

      // 2. Verify the Token
      const payload = this.jwtService.verify(token);
      const actorId = payload.sub;

      // Attach the user ID to the socket instance for future event handlers
      client.data.user = { id: actorId };

      // 3. ✨ THE ROOM STRATEGY ✨
      // First, join a personal room named after their own ID.
      // This allows the server to send direct notifications specifically to them.
      client.join(`user:${actorId}`);

      // Second, fetch all their active conversations and join those rooms.
      // This allows us to broadcast "new_message" to `room:conversation_123`
      // and only the participants will receive it!
      const inbox = await this.conversationsService.getUserInbox(actorId);
      const conversationRooms = inbox.map(
        (conv) => `conversation:${conv._id.toString()}`,
      );

      if (conversationRooms.length > 0) {
        client.join(conversationRooms);
      }

      this.logger.log(`Client connected: ${client.id} (User: ${actorId})`);

      // 4. (Phase 4 Teaser) Update Redis Presence to ONLINE
      // await this.presenceService.setOnline(actorId);
    } catch (error) {
      this.logger.warn(
        `Unauthorized WebSocket connection attempt: ${client.id}`,
      );
      client.disconnect(); // Brutally drop unauthorized connections to save RAM
    }
  }

  // ========================================================================
  // HANDLE DISCONNECT
  // ========================================================================
  async handleDisconnect(client: Socket) {
    const actorId = client.data?.user?.id;
    if (actorId) {
      this.logger.log(`Client disconnected: ${client.id} (User: ${actorId})`);
      // 4. (Phase 4 Teaser) Update Redis Presence to OFFLINE
      // await this.presenceService.setOffline(actorId);
    }
  }

  // ========================================================================
  // HANDLE DISCONNECT
  // ========================================================================
  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @CorrelationId() correlationId: string,
    @MessageBody()
    payload: {
      clientMessageId: string;
      conversationId: string;
      content: string;
    },
  ) {
    const senderId = client.data.user.id;

    // 1. Save to MongoDB (Idempotent)
    const { savedMessage, participants } =
      await this.messagesService.processNewMessage(
        senderId,
        payload.conversationId,
        payload.clientMessageId,
        payload.content,
      );

    // 2. BROADCAST VIA WEBSOCKETS (Redis Adapter handles multi-pod routing)
    // We emit to the specific conversation room. Anyone actively looking at this chat gets it instantly.
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit("new_message", {
        id: savedMessage._id,
        clientMessageId: savedMessage.clientMessageId, // So the sender's UI knows to stop showing a loading spinner
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
      });

    // 3. ✨ SMART OFFLINE ROUTING ✨
    // Check the presence of everyone else in the chat.
    for (const participant of participants) {
      const isMe = participant.userId === senderId;
      if (isMe) continue;

      const isOnline = await this.presenceService.isUserOnline(
        participant.userId,
      );

      // If they are offline, the WebSocket broadcast missed them.
      // We must fire a Kafka event so the Notification Service sends a Push/Email.
      if (!isOnline) {
        publishEvent("messaging.events", {
          eventId: uuidv7(),
          eventType: "message.unread.offline",
          eventVersion: "1.0",
          timestamp: new Date().toISOString(),
          producer: "messaging-service",
          correlationId, // Traceability
          actorId: senderId,
          data: {
            message_id: savedMessage._id.toString(),
            conversation_id: payload.conversationId,
            target_user_id: participant.userId,
            content_snippet: savedMessage.content?.substring(0, 100),
          },
        }).catch((err) =>
          this.logger.error("Failed to emit offline notification event", err),
        );
      }
    }

    // 4. Acknowledge back to the sender
    return { status: "success", clientMessageId: payload.clientMessageId };
  }

  // ========================================================================
  // HANDLE READ RECEIPTS (Watermark Pattern)
  // ========================================================================
  @SubscribeMessage("mark_as_read")
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; messageId: string },
  ) {
    const actorId = client.data.user.id;

    try {
      // 1. Update the Watermark in MongoDB (O(1) operation)
      const { readAt } = await this.conversationsService.updateReadWatermark(
        actorId,
        payload.conversationId,
        payload.messageId,
      );

      // 2. Broadcast to the Conversation Room
      // By using `client.to(room).emit()`, it sends to everyone in the room EXCEPT the sender.
      // We don't need to tell the person who just read the message that they read it!
      client
        .to(`conversation:${payload.conversationId}`)
        .emit("receipt_updated", {
          conversationId: payload.conversationId,
          userId: actorId, // The person who just read it
          messageId: payload.messageId, // The watermark boundary
          readAt: readAt.toISOString(),
        });

      // 3. Acknowledge success to the client
      return { status: "success" };
    } catch (error) {
      this.logger.error(
        `Failed to update read receipt for user ${actorId}`,
        error,
      );
      return { status: "error", message: "Failed to update watermark" };
    }
  }
}
