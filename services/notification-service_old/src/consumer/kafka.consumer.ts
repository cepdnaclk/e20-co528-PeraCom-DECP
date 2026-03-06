import { createConsumer, type BaseEvent } from "@decp/event-bus";
import type { NotificationService } from "../notification/notification.service.js";
import { handleIdentityEvent } from "./handlers/identity-event.handler.js";
import { env } from "../config/validateEnv.config.js";

let consumer: Awaited<ReturnType<typeof createConsumer>>;

export async function startKafkaConsumer(
  notificationService: NotificationService,
): Promise<() => Promise<void>> {
  const brokers = env.KAFKA_BROKER.split(",").map((s) => s.trim());

  consumer = await createConsumer(
    brokers,
    "notification-service",
    "identity.events",
  );

  await consumer.run({
    eachMessage: async ({
      topic,
      partition,
      message,
    }: {
      topic: string;
      partition: number;
      message: { value: Buffer | null; offset: string };
    }) => {
      try {
        const value = message.value?.toString();
        if (!value) return;

        const event = JSON.parse(value) as {
          eventId: string;
          eventType: string;
          eventVersion?: string;
          timestamp?: string;
          producer?: string;
          actorId?: string;
          correlationId?: string;
          data?: unknown;
        };

        if (!event.eventId || !event.eventType) {
          console.warn("[kafka] Invalid event shape, skipping:", {
            topic,
            partition,
            offset: message.offset,
          });
          return;
        }

        if (topic === "identity.events") {
          await handleIdentityEvent(event as BaseEvent<unknown>, notificationService);
        }
      } catch (err) {
        console.error("[kafka] Error processing message:", err);
      }
    },
  });

  return async () => {
    await consumer.disconnect();
    console.log("Kafka consumer disconnected");
  };
}
