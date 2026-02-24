import { Kafka } from "kafkajs";
export async function createConsumer(brokers, groupId, topic) {
    const kafka = new Kafka({
        brokers: brokers,
    });
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    console.log(`🎧 Consumer connected to topic [${topic}] with group [${groupId}]`);
    return consumer;
}
//# sourceMappingURL=consumer.js.map