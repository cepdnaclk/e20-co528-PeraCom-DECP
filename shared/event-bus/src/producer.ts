import { propagation, context } from "@opentelemetry/api";
import { Kafka, type Producer } from "kafkajs";

let producer: Producer;

// 1. Require the brokers to be passed in from the microservice
export async function connectProducer(brokers: string[]) {
  const kafka = new Kafka({
    brokers: brokers, // Now it gets the perfectly loaded variables!
  });

  producer = kafka.producer();
  await producer.connect();
  console.log("🚀 Shared Event Bus Producer connected");
}

// 2. Create a publish function that can be used across services
export async function publishEvent(topic: string, event: any) {
  // 1. Prepare a headers object for Kafka
  const headers: Record<string, string> = {};

  // 1. Grab the active context (This is where 'getActiveContext' actually lives)
  const activeContext = context.active();

  // 2. Inject the context into the headers
  // OpenTelemetry's propagation handles the check for you internally.
  // If the context is empty, it just won't add headers.
  propagation.inject(activeContext, headers);

  await producer.send({
    topic,
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
        headers,
      },
    ],
  });
}
