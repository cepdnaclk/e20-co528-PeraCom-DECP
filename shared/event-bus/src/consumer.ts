import { Kafka, type Consumer } from "kafkajs";

export async function createConsumer(
  brokers: string[],
  groupId: string,
  topic: string,
): Promise<Consumer> {
  const kafka = new Kafka({
    brokers: brokers,
  });

  const consumer = kafka.consumer({ groupId });
  await consumer.connect();

  await consumer.subscribe({ topic, fromBeginning: true });
  console.log(
    `🎧 Consumer connected to topic [${topic}] with group [${groupId}]`,
  );
  return consumer;
}
