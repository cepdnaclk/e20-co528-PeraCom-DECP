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
import {
  NotificationPreference,
  type NotificationPreferenceDocument,
} from "../preferences/schemas/preference.schema.js";
import { EmailService } from "../emails/email.service.js";

type LoginEventData = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

@Injectable()
export class NotificationProcessorService {
  constructor(
    @InjectPinoLogger(NotificationProcessorService.name)
    private readonly logger: PinoLogger,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreferenceDocument>,
    private readonly emailService: EmailService,
  ) {}

  // ========================================================================
  // THE PREFERENCE ENGINE
  // ========================================================================
  private async getUserPreferences(userId: string) {
    // We try to find their explicit preferences. If they haven't set any,
    // the Mongoose default values (everything turned ON) will apply.
    let prefs = await this.preferenceModel.findOne({ userId }).lean().exec();

    if (!prefs) {
      prefs = new this.preferenceModel({ userId }).toObject();
    }
    return prefs;
  }

  // ========================================================================
  // 1.1 HANDLE USER LOGIN (Account Security)
  // ========================================================================
  async handleUserLogin(data: LoginEventData) {
    const recipientId = data.user_id;

    console.log("Handling user login event for user_id:", recipientId);

    // If no user_id drop notification
    if (!recipientId) {
      this.logger.warn(
        { data },
        "Dropped login event because user_id is missing",
      );
      return;
    }

    // Get user preference for notifications
    const prefs = await this.getUserPreferences(recipientId);
    if (!prefs.categories.account_security) {
      this.logger.debug(
        { recipientId },
        "User opted out of account security notifications. Dropping login alert.",
      );
      return;
    }

    const loginTime = new Date().toISOString();

    // Send email if prefered
    if (prefs.channels.email && data.email) {
      await this.emailService.sendLoginNotificationEmail({
        ...data,
        loginTime,
      });
      this.logger.info(
        `[MOCK] Sending Login Alert Email to ${data.email} for user ${recipientId}`,
      );
    }

    // Send In App Notification if prefered
    if (prefs.channels.inApp) {
      await this.notificationModel.create({
        recipientId,
        actorId: recipientId,
        actionType: ActionType.USER_LOGGED_IN,
        entityType: EntityType.USER,
        entityId: recipientId,
        metadata: {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          role: data.role,
          login_time: loginTime,
        },
      });
    }

    // Job completion message
    this.logger.info(
      { recipientId },
      "Processed login notification according to user preferences",
    );
  }

  // ========================================================================
  // 1.2 HANDLE USER CREATED (Onboarding)
  // ========================================================================
  async handleUserCreated(data: any) {
    const recipientId = data.user_id;

    console.log("Handling new user created event for user_id:", recipientId);

    if (!recipientId) {
      this.logger.warn(
        { data },
        "Dropped user created event because user_id is missing",
      );
      return;
    }

    // Step A: Initialize the user's NotificationPreference document in MongoDB with defaults
    let prefs;
    try {
      prefs = await this.preferenceModel.create({ userId: recipientId });
      this.logger.info(
        { recipientId },
        "Created default notification preferences for new user",
      );
    } catch (error) {
      this.logger.error(
        { error, recipientId },
        "Failed to create default preferences. Will use default fallback.",
      );
      prefs = {
        channels: { inApp: true, email: true },
        categories: { account_security: true },
      }; // Fallback defaults
    }

    // Step C: Check the preference matrix for the email channel. Use EmailService to send Welcome Email.
    if (prefs.channels.email && data.email) {
      await this.emailService.sendWelcomeEmail({
        email: data.email,
        name: `${data.first_name} ${data.last_name}`,
        role: data.role,
      });
      this.logger.info(
        `[MOCK] Sending Welcome Email to ${data.email} for user ${recipientId}`,
      );
    }

    // Step B: Create an In-App Notification in the notifications collection.
    if (prefs.channels.inApp) {
      await this.notificationModel.create({
        recipientId,
        actorId: recipientId, // self-triggered or system
        actionType: ActionType.SYSTEM_ALERT,
        entityType: EntityType.USER, // generic placeholder
        entityId: recipientId, // generic entity ID
        metadata: {
          message:
            "Welcome to PeraCom DECP! We are excited to have you join our academic community.",
        },
      });
      this.logger.info({ recipientId }, "Created welcome in-app notification");
    }

    this.logger.info(
      { recipientId },
      "Successfully processed user creation event",
    );
  }

  // ========================================================================
  // 1.3 HANDLE BATCH USERS CREATED (Mass Onboarding)
  // ========================================================================
  async handleBatchUserCreated(users: any[], actorId?: string) {
    this.logger.info(
      { count: users.length, actorId },
      "Processing bulk user onboarding",
    );

    if (!users || users.length === 0) return;

    // 1. Bulk Prepare Preferences
    const preferenceOps = users.map((user) => ({
      updateOne: {
        filter: { userId: user.user_id },
        update: { $setOnInsert: { userId: user.user_id } },
        upsert: true,
      },
    }));

    // 2. Bulk Prepare In-App Alerts
    const notificationDocs = users.map((user) => ({
      recipientId: user.user_id,
      actorId: actorId || "system", // Ensure actorId is logged/recorded
      actionType: ActionType.SYSTEM_ALERT,
      entityType: EntityType.USER,
      entityId: "welcome",
      metadata: {
        message:
          "Welcome to PeraCom DECP! We are excited to have you join our academic community.",
      },
    }));

    try {
      // Fire database operations in parallel
      await Promise.all([
        this.preferenceModel.bulkWrite(preferenceOps),
        this.notificationModel.insertMany(notificationDocs),
      ]);

      this.logger.info(
        "Successfully initialized preferences and in-app alerts for batch",
      );

      // 3. Email Dispatch (The "Gentle" Loop)
      for (const user of users) {
        if (!user.email) continue;

        try {
          // Check preferences lazily to ensure we don't spam if manually opted out somehow?
          // New users will have everything enabled.
          await this.emailService.sendWelcomeEmail({
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role,
          });
          // Small delay to avoid mailer rate limits
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (emailError: any) {
          // Optimization Pattern: Log failed emails specifically with their user_id
          this.logger.error(
            {
              error: emailError.message,
              user_id: user.user_id,
              email: user.email,
            },
            "Failed to send welcome email in batch processing",
          );
        }
      }

      this.logger.info("Successfully processed batch user creation event");
    } catch (error) {
      this.logger.error(
        { error },
        "Bulk onboarding failed partially or completely",
      );
    }
  }

  // ========================================================================
  // 1.4 HANDLE USER REACTIVATED
  // ========================================================================
  async handleUserReactivated(data: any) {
    const recipientId = data.user_id;

    this.logger.info({ recipientId }, "Handling user reactivate event");

    if (!recipientId) return;

    // No need to check preferences for reactivated users

    // Step A: In-App Notification
    await this.notificationModel.create({
      recipientId,
      actorId: "system", // Admin action
      actionType: ActionType.SYSTEM_ALERT,
      entityType: EntityType.USER,
      entityId: recipientId,
      metadata: {
        message:
          "Your account access has been successfully restored. Welcome back!",
      },
    });
    this.logger.info(
      { recipientId },
      "Created reactivated in-app notification",
    );

    // Step B: Email Dispatch
    if (data.email) {
      await this.emailService.sendReactivationEmail({
        email: data.email,
        name: `${data.first_name} ${data.last_name}`.trim(),
      });
      this.logger.info(
        `[MOCK] Sending Reactivation Email to ${data.email} for user ${recipientId}`,
      );
    }

    this.logger.info(
      { recipientId },
      "Successfully processed user reactivation event",
    );
  }

  // ========================================================================
  // 1.5 HANDLE USER SUSPENDED
  // ========================================================================
  async handleUserSuspended(data: any, actorId?: string) {
    const recipientId = data.user_id;

    this.logger.info({ recipientId, actorId }, "Handling user suspended event");

    if (!recipientId) return;

    // Step A: In-App Notification (Always log this system alert for auditing / future view)
    await this.notificationModel.create({
      recipientId,
      actorId: actorId || "system", // Admin action
      actionType: ActionType.SYSTEM_ALERT,
      entityType: EntityType.USER,
      entityId: recipientId,
      metadata: {
        message:
          "Your account access has been suspended by the administration.",
      },
    });
    this.logger.info({ recipientId }, "Created suspended in-app notification");

    // Step B: Email Dispatch
    if (data.email) {
      await this.emailService.sendSuspensionEmail({
        email: data.email,
        name: `${data.first_name} ${data.last_name}`.trim(),
      });
      this.logger.info(
        `[MOCK] Sending Suspension Email to ${data.email} for user ${recipientId}`,
      );
    }

    this.logger.info(
      { recipientId, actorId },
      "Successfully processed user suspension event",
    );
  }

  // ========================================================================
  // 1.6 HANDLE BATCH USERS SUSPENDED
  // ========================================================================
  async handleBatchSuspension(users: any[], actorId?: string) {
    this.logger.info(
      { count: users.length, actorId },
      "Processing batch user suspension",
    );

    if (!users || users.length === 0) return;

    // Action 1: In-App Notification (Always log this system alert for auditing)
    const notificationDocs = users.map((user) => ({
      recipientId: user.user_id,
      actorId: actorId || "system", // Admin action
      actionType: ActionType.SYSTEM_ALERT,
      entityType: EntityType.USER,
      entityId: "suspended", // Generic ID for batch suspensions
      metadata: {
        message: "Your account access has been suspended by administration.",
      },
    }));

    try {
      await this.notificationModel.insertMany(notificationDocs);
      this.logger.info(
        "Successfully created in-app suspension alerts for batch",
      );

      // Action 2 & 3: Email Dispatch with Resilience
      for (const user of users) {
        if (!user.email) continue;

        try {
          // Action 2 constraint: Send the suspend email to all
          await this.emailService.sendSuspensionEmail({
            email: user.email,
            name: `${user.first_name} ${user.last_name}`.trim(),
          });
          this.logger.info(
            `[MOCK] Sending Suspension Email to ${user.email} for user ${user.user_id}`,
          );

          // Small delay to avoid mailer rate limits
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (emailError: any) {
          this.logger.error(
            {
              error: emailError.message,
              user_id: user.user_id,
              email: user.email,
            },
            "Failed to send suspension email in batch processing",
          );
        }
      }

      this.logger.info(
        { count: users.length, actorId },
        "Successfully processed batch user suspension event",
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Batch suspension failed partially or completely",
      );
    }
  }

  // ========================================================================
  // 1.7 HANDLE USER PROFILE UPDATED
  // ========================================================================
  async handleUserProfileUpdated(data: any) {
    const recipientId = data.user_id;

    this.logger.info(
      { recipientId },
      "Handling user profile updated event",
    );

    if (!recipientId) return;

    // Step A: Check Preferences
    const prefs = await this.getUserPreferences(recipientId);

    // Step B: In-App Notification
    if (prefs.channels.inApp) {
      await this.notificationModel.create({
        recipientId,
        actorId: recipientId, // self-triggered
        actionType: ActionType.SYSTEM_ALERT,
        entityType: EntityType.USER,
        entityId: recipientId,
        metadata: {
          message: "Your profile details have been successfully updated.",
        },
      });
      this.logger.info({ recipientId }, "Created profile updated in-app notification");
    }

    // Step C: Email Dispatch
    // Check if security notifications are opted into
    if (prefs.categories.account_security) {
      if (prefs.channels.email && data.email) {
        await this.emailService.sendProfileUpdateEmail({
          email: data.email,
          name: `${data.first_name} ${data.last_name}`.trim(),
        });
        this.logger.info(
          `[MOCK] Sending Profile Update Email to ${data.email} for user ${recipientId}`,
        );
      }
    } else {
      this.logger.debug(
        { recipientId },
        "User opted out of account security notifications. Dropping profile update email alert.",
      );
    }

    this.logger.info({ recipientId }, "Successfully processed user profile updated event");
  }

  // ========================================================================
  // 1.8 HANDLE ADMIN USER UPDATED
  // ========================================================================
  async handleAdminUserUpdated(data: any) {
    const recipientId = data.user_id;

    this.logger.info(
      { recipientId },
      "Handling admin user updated event",
    );

    if (!recipientId) return;

    // Step A: Check Preferences
    const prefs = await this.getUserPreferences(recipientId);

    // Step B: In-App Notification
    if (prefs.channels.inApp) {
      await this.notificationModel.create({
        recipientId,
        actorId: "system", // Admin triggered
        actionType: ActionType.SYSTEM_ALERT,
        entityType: EntityType.USER,
        entityId: recipientId,
        metadata: {
          message: "An administrator has updated your account details and role permissions.",
        },
      });
      this.logger.info({ recipientId }, "Created admin update in-app notification");
    }

    // Step C: Email Dispatch
    // Check if security notifications are opted into
    if (prefs.categories.account_security) {
      if (prefs.channels.email && data.email) {
        await this.emailService.sendAdminUpdateEmail({
          email: data.email,
          name: `${data.first_name} ${data.last_name}`.trim(),
          role: data.role,
        });
        this.logger.info(
          `[MOCK] Sending Admin Update Email to ${data.email} for user ${recipientId}`,
        );
      }
    } else {
      this.logger.debug(
        { recipientId },
        "User opted out of account security notifications. Dropping admin update email alert.",
      );
    }

    this.logger.info({ recipientId }, "Successfully processed admin user updated event");
  }

  // ========================================================================
  // 1.9 HANDLE BATCH USERS ROLE UPDATED
  // ========================================================================
  async handleBatchRoleUpdate(role: string, users: any[], actorId?: string) {
    this.logger.info(
      { count: users.length, role, actorId },
      "Processing batch user role update",
    );

    if (!users || users.length === 0) return;

    // Action 1: Bulk create in-app notifications (Fast DB operation)
    // We log these regardless of preferences for accurate history
    const notificationDocs = users.map((user) => ({
      recipientId: user.user_id,
      actorId: actorId || "system", // Admin triggered
      actionType: ActionType.SYSTEM_ALERT,
      entityType: EntityType.USER, 
      entityId: "role_update",
      metadata: {
        message: `Your account role has been updated to ${role} by administration.`,
      },
    }));

    try {
      await this.notificationModel.insertMany(notificationDocs);
      this.logger.info("Successfully created in-app role update alerts for batch");
      
      const CHUNK_SIZE = 25; // Send 25 emails at a time
      
      // Action 2 & 3: Chunked Email Sending
      for (let i = 0; i < users.length; i += CHUNK_SIZE) {
        const chunk = users.slice(i, i + CHUNK_SIZE);
        
        await Promise.allSettled(
          chunk.map(async (user) => {
            if (!user.email) return;
            
            // Explicitly check preferences for each user in the batch
            const prefs = await this.getUserPreferences(user.user_id);
            if (prefs.channels.email && prefs.categories.account_security) {
              return this.emailService.sendBulkRoleUpdateEmail({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`.trim(),
                role: role // The new role globally applied
              }).then(() => {
                this.logger.info(
                  `[MOCK] Sending Bulk Role Update Email to ${user.email} for user ${user.user_id}`,
                );
              });
            } else {
              this.logger.debug(
                { recipientId: user.user_id },
                "User opted out of account security notifications. Dropping admin update email alert.",
              );
            }
          })
        );
        
        // Small delay to let the SMTP connection pool breathe between chunks
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.info(
        { count: users.length, role, actorId },
        "Successfully processed batch user role update event",
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Batch role update processing failed partially or completely",
      );
    }
  }
}
