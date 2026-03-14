import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { createConsumer, startConsuming } from "@decp/event-bus";
import type { BaseEvent, Consumer } from "@decp/event-bus";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { IdentityNotificationService } from "../processor/identity-notification.service.js";
import { EngagementNotificationService } from "../processor/engagement-notification.service.js";
import { env } from "../config/validateEnv.config.js";

@Injectable()
export class NotificationConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private consumer!: Consumer;

  constructor(
    @InjectPinoLogger(NotificationConsumerService.name)
    private readonly logger: PinoLogger,
    private readonly identityProcessor: IdentityNotificationService,
    private readonly engagementProcessor: EngagementNotificationService,
  ) {}

  // ========================================================================
  // START CONSUMING ON BOOT
  // ========================================================================
  async onModuleInit() {
    this.logger.info("... Initializing Kafka Consumer for Notifications ...");

    try {
      // 1. Connect and Subscribe
      // We listen to all major domain topics.
      this.consumer = await createConsumer(
        [env.KAFKA_BROKER],
        env.KAFKA_GROUP_ID, // Unique group ID for this microservice
        [env.KAFKA_TOPICS],
        env.KAFKA_READ_FROM_BEGINNING, // Do NOT read from the beginning
        env.KAFKA_CLIENT_ID, // Client ID for better observability in Kafka
      );

      // 2. Start the Infinite Listening Loop
      await startConsuming(this.consumer, async (topic, event) => {
        console.log("Received event:", event);
        await this.routeEvent(topic, event);
      });
    } catch (error) {
      this.logger.error("Failed to initialize Kafka consumer", error);
      // Depending on your deployment strategy, you might want to process.exit(1) here
      // so Kubernetes knows the pod is unhealthy and restarts it.
    }
  }

  // ========================================================================
  // THE ROUTER (Switchboard)
  // ========================================================================
  private async routeEvent(topic: string, event: BaseEvent<any>) {
    this.logger.debug(
      `Received event [${event.eventType}] from topic [${topic}]`,
    );

    try {
      // We route the event to the correct business logic handler based on its type.
      switch (event.eventType) {
        // --- IDENTITY EVENTS ---
        case "identity.user.login": {
          this.logger.debug(`User logged in: ${event.data.user_id}`);
          await this.identityProcessor.handleUserLogin(event.data);
          break;
        }

        case "identity.user.created": {
          this.logger.debug(`New user created: ${event.data.user_id}`);
          await this.identityProcessor.handleUserCreated(event.data);
          break;
        }

        case "identity.batch_users.created": {
          this.logger.info(
            { count: event.data.count, actorId: event.actorId },
            "New users batch created.",
          );
          await this.identityProcessor.handleBatchUserCreated(
            event.data.users,
            event.actorId,
          );
          break;
        }

        case "identity.user.reactivate": {
          this.logger.debug(`User reactivated: ${event.data.user_id}`);
          await this.identityProcessor.handleUserReactivated(event.data);
          break;
        }

        case "identity.user.suspended": {
          this.logger.info(
            { actorId: event.actorId },
            `User suspended: ${event.data.user_id}`,
          );
          await this.identityProcessor.handleUserSuspended(
            event.data,
            event.actorId,
          );
          break;
        }

        case "identity.user_profile.updated": {
          this.logger.debug(`User profile updated: ${event.data.user_id}`);
          await this.identityProcessor.handleUserProfileUpdated(event.data);
          break;
        }

        case "identity.admin_user.updated": {
          this.logger.debug(
            `Admin updated user profile: ${event.data.user_id}`,
          );
          await this.identityProcessor.handleAdminUserUpdated(event.data);
          break;
        }

        case "identity.batch_users.suspended": {
          this.logger.info(
            {
              count: event.data.count,
              batch: event.data.batch,
              actorId: event.actorId,
            },
            "Batch users suspended.",
          );
          await this.identityProcessor.handleBatchSuspension(
            event.data.users,
            event.actorId,
          );
          break;
        }

        case "identity.batch_users.updated": {
          this.logger.info(
            {
              count: event.data.count,
              batch: event.data.batch,
              role: event.data.role,
              actorId: event.actorId,
            },
            "Batch users role updated.",
          );
          await this.identityProcessor.handleBatchRoleUpdate(
            event.data.role,
            event.data.users,
            event.actorId,
          );
          break;
        }

        // --- ENGAGEMENT EVENTS ---
        case "engagement.post.created": {
          this.logger.info(
            `New post created: ${event.data.post_id} by user ${event.actorId}`,
          );
          await this.engagementProcessor.handlePostCreated(
            event.data.post_id,
            event.actorId,
          );
          break;
        }

        case "engagement.post.reposted": {
          this.logger.info(
            `Post reposted: ${event.data.original_post_id} by user ${event.actorId}`,
          );
          await this.engagementProcessor.handlePostReposted(
            event.actorId!,
            event.data,
          );
          break;
        }

        case "engagement.post.deleted": {
          this.logger.info(
            `Post deleted: ${event.data.post_id} by user ${event.actorId}`,
          );
          await this.engagementProcessor.handlePostDeleted(
            event.actorId!,
            event.data,
          );
          break;
        }

        case "engagement.comment.created": {
          this.logger.info(
            `New comment created on post ${event.data.post_id} by user ${event.actorId}`,
          );
          await this.engagementProcessor.handleCommentCreated(
            event.actorId!,
            event.data,
          );
          break;
        }

        default:
          // We safely ignore events we don't care about.
          this.logger.warn(`Unhandled event type: ${event.eventType}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process event ${event.eventId} (${event.eventType})`,
        error,
      );
      // 🛡️ Note: Because we catch the error here, the `startConsuming` loop will
      // not crash, and Kafka will move on to the next message.
    }
  }

  // ========================================================================
  // GRACEFUL SHUTDOWN
  // ========================================================================
  async onModuleDestroy() {
    if (this.consumer) {
      this.logger.info("Disconnecting Kafka Consumer...");
      await this.consumer.disconnect();
    }
  }
}
