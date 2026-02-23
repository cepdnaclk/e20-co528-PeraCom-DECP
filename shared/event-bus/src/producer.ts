import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
});

const producer = kafka.producer();

// 1. Create a dedicated setup function
export async function connectProducer() {
  await producer.connect();
  console.log("🚀 Shared Event Bus Producer connected");
}

// 2. Create a publish function that can be used across services
export async function publishEvent(topic: string, event: any) {
  await producer.send({
    topic,
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
      },
    ],
  });
}
