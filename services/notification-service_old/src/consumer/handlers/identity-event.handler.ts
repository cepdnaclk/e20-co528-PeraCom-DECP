import type { BaseEvent } from "@decp/event-bus";
import type { NotificationService } from "../../notification/notification.service.js";

interface IdentityUserCreatedData {
  user_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

interface IdentityUserSuspendedData {
  user_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

interface IdentityUserProfileUpdatedData {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export async function handleIdentityEvent(
  event: BaseEvent<unknown>,
  notificationService: NotificationService,
): Promise<void> {
  const eventType = event.eventType;
  const data = event.data as Record<string, unknown>;

  switch (eventType) {
    case "identity.user.created": {
      const d = data as unknown as IdentityUserCreatedData;
      const userId = d?.user_id;
      if (typeof userId === "string") {
        await notificationService.create({
          userId,
          type: "welcome",
          title: "Welcome to DECP",
          body: "Your account has been created successfully.",
          data: { eventType, ...d },
          eventId: event.eventId,
          eventType,
        });
      }
      break;
    }

    case "identity.user.suspended": {
      const d = data as unknown as IdentityUserSuspendedData;
      const userId = d?.user_id;
      if (typeof userId === "string") {
        await notificationService.create({
          userId,
          type: "account_suspended",
          title: "Account suspended",
          body: "Your account has been suspended. Please contact support.",
          data: { eventType, ...d },
          eventId: event.eventId,
          eventType,
        });
      }
      break;
    }

    case "identity.user_profile.updated": {
      const d = data as unknown as IdentityUserProfileUpdatedData;
      const userId = d?.user_id;
      if (typeof userId === "string") {
        await notificationService.create({
          userId,
          type: "profile_updated",
          title: "Profile updated",
          body: "Your profile has been updated successfully.",
          data: { eventType, ...d },
          eventId: event.eventId,
          eventType,
        });
      }
      break;
    }

    default:
      console.log(`[identity-event] Unhandled eventType: ${eventType}`);
  }
}
