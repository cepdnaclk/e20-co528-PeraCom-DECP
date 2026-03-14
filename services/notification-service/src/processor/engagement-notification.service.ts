import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import {
  Notification,
  ActionType,
  EntityType,
  type NotificationDocument,
} from "../notifications/schemas/notification.schema.js";
import { EmailService } from "../emails/email.service.js";
import { PreferencesService } from "../preferences/preferences.service.js";

@Injectable()
export class EngagementNotificationService {
  constructor(
    @InjectPinoLogger(EngagementNotificationService.name)
    private readonly logger: PinoLogger,

    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly emailService: EmailService,
    private readonly preferenceService: PreferencesService,
  ) {}
  // ========================================================================
  // 2.0 HANDLE NEW POST CREATED (Notify Followers)
  // ========================================================================
  async handlePostCreated(postId: string, actorId?: string) {
    this.logger.info(
      { postId, actorId },
      "Processing new post created event for notifications",
    );

    if (!postId || !actorId) return;

    // Step A: Check Preferences
    const prefs = await this.preferenceService.getPreferences(actorId);

    // Step B: In-App Notification
    if (prefs.channels.inApp) {
      await this.notificationModel.create({
        recipientId: actorId, // post creator
        actorId: "system", // Admin triggered
        actionType: ActionType.SYSTEM_ALERT,
        entityType: EntityType.POST,
        entityId: postId,
        metadata: {
          message:
            "Your new post has been successfully created and is now live on the platform.",
        },
      });
      this.logger.info(
        { recipientId: actorId },
        "Created post created in-app notification",
      );
    }

    // Step C: No Email Dispatch

    this.logger.info(
      { recipientId: actorId },
      "Successfully processed new post created event",
    );
  }

  // ========================================================================
  // 2.1 HANDLE POST REPOSTED (Notify Original Author)
  // ========================================================================
  async handlePostReposted(actorId: string, data: any) {
    const recipientId = data.original_author_id;

    this.logger.info(
      { recipientId, actorId, isQuote: data.is_quote },
      "Handling post reposted event",
    );

    // 1. Guard Clause: Don't notify a user for reposting their own content
    if (actorId === recipientId) {
      this.logger.debug(
        { actorId },
        "User reposted their own post. Dropping notification.",
      );
      return;
    }

    // 2. Check User Preferences
    const prefs = await this.preferenceService.getPreferences(recipientId);

    // Assuming you have an engagement/social category in your preferences
    if (!prefs.channels.inApp || !prefs.categories.social_interactions) {
      this.logger.debug(
        { recipientId },
        "User opted out of in-app engagement notifications. Dropping alert.",
      );
      return;
    }

    // 3. Craft the Message
    const actionText = data.is_quote ? "quoted" : "reposted";
    // Note: If you resolve the actor's name earlier in the pipeline, you can use it here!
    // Otherwise, a generic message works, or the frontend can resolve the actorId to a name.
    const message = `Someone ${actionText} your post.`;

    // 4. Create the In-App Notification
    try {
      await this.notificationModel.create({
        recipientId,
        actorId,
        actionType: ActionType.POST_REPOSTED,
        entityType: EntityType.POST,
        entityId: data.original_post_id,
        metadata: {
          message,
          new_post_id: data.new_post_id,
          is_quote: data.is_quote,
        },
      });

      this.logger.info(
        { recipientId, actorId },
        `Successfully created ${actionText} in-app notification`,
      );
    } catch (error) {
      this.logger.error(
        { error, recipientId, actorId },
        "Failed to create repost notification",
      );
    }
  }

  // ========================================================================
  // 2.2 HANDLE DELETE POST BY ADMIN (Notify Original Author)
  // ========================================================================
  async handlePostDeleted(actorId: string, data: any) {
    const recipientId = data.author_id; // The user whose post was deleted

    this.logger.info(
      {
        postId: data.post_id,
        actorId,
        recipientId,
        isAdmin: data.deleted_by_admin,
      },
      "Handling admin post deleted event",
    );

    // 1. Guard Clause: We only care about admin deletions for notifications
    if (!data.deleted_by_admin) {
      this.logger.debug(
        { postId: data.post_id },
        "Post was self-deleted. Dropping notification.",
      );
      return;
    }

    if (!recipientId) {
      this.logger.error(
        { payload: data },
        "Cannot process admin deletion: author_id is missing from payload",
      );
      return;
    }

    // 2. Fetch User Preferences (Mainly for email routing on moderation actions)
    const prefs = await this.preferenceService.getPreferences(recipientId);

    // 3. Create In-App Notification (Always forced for admin moderation)
    try {
      await this.notificationModel.create({
        recipientId,
        actorId: actorId, // The admin who did it
        actionType: ActionType.SYSTEM_ALERT,
        entityType: EntityType.POST,
        entityId: data.post_id, // Keep the ID for reference/auditing
        metadata: {
          message:
            "One of your posts has been removed by an administrator for violating community guidelines.",
          deleted_by_admin: true,
        },
      });

      this.logger.info(
        { recipientId, postId: data.post_id },
        "Successfully created admin-deletion in-app notification",
      );
    } catch (error) {
      this.logger.error(
        { error, recipientId, postId: data.post_id },
        "Failed to create admin-deletion in-app notification",
      );
    }
  }

  // ========================================================================
  // 2.3 HANDLE COMMENT RECEIVED (Notify Post Author)
  // ========================================================================
  async handleCommentCreated(actorId: string, data: any) {
    const recipientId = data.post_author_id; // The author of the original post

    this.logger.info(
      {
        postId: data.post_id,
        commentId: data.comment_id,
        actorId,
        recipientId,
      },
      "Handling comment created event",
    );

    // 1. Guard Clause: Missing recipient data
    if (!recipientId) {
      this.logger.warn(
        { payload: data },
        "Dropped comment notification: post_author_id is missing from payload",
      );
      return;
    }

    // 2. Guard Clause: The "Self-Comment" Check
    // Don't notify the user if they are commenting on their own post!
    if (actorId === recipientId) {
      this.logger.debug(
        { actorId, postId: data.post_id },
        "User commented on their own post. Dropping notification.",
      );
      return;
    }

    // 3. Check User Preferences
    const prefs = await this.preferenceService.getPreferences(recipientId);

    // Note: Adjust 'social_engagement' if your preference schema uses a different name
    // If you don't have granular categories yet, you can skip this category check.

    // 4. Create In-App Notification
    if (prefs.channels.inApp) {
      try {
        await this.notificationModel.create({
          recipientId,
          actorId,
          actionType: ActionType.COMMENTED, // Ensure POST_COMMENTED exists in your ActionType Enum!
          entityType: EntityType.POST,
          entityId: data.post_id,
          metadata: {
            message: "Someone commented on your post.",
            comment_id: data.comment_id,
          },
        });

        this.logger.info(
          { recipientId, actorId, postId: data.post_id },
          "Successfully created comment in-app notification",
        );
      } catch (error) {
        this.logger.error(
          { error, recipientId, actorId },
          "Failed to create comment in-app notification",
        );
      }
    }
  }
}
