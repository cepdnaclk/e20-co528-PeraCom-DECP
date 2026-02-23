import { Kafka } from "kafkajs";
const kafka = new Kafka({
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
});
export async function createConsumer(groupId, topic) {
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic });
    return consumer;
}
//# sourceMappingURL=consumer.js.map