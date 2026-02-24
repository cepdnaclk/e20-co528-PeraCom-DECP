import { Kafka } from "kafkajs";
let producer;
// 1. Require the brokers to be passed in from the microservice
export async function connectProducer(brokers) {
    const kafka = new Kafka({
        brokers: brokers, // Now it gets the perfectly loaded variables!
    });
    producer = kafka.producer();
    await producer.connect();
    console.log("🚀 Shared Event Bus Producer connected");
}
// 2. Create a publish function that can be used across services
export async function publishEvent(topic, event) {
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
//# sourceMappingURL=producer.js.map