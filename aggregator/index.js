const { Kafka } = require("kafkajs");
const db = require("./db");
const { groupAndAverage } = require("./utils");

const kafka = new Kafka({ clientId: "aggregator", brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "aggregator-group" });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: "iot-sensor-data", fromBeginning: false });

  let buffer = [];

  setInterval(async () => {
    const grouped = groupAndAverage(buffer);
    buffer = [];
    for (const record of grouped) {
      await db.insertAggregate(record);
    }
  }, 60_000); // 1 minute window

  await consumer.run({
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());
      buffer.push(data);
    },
  });
}

start();
