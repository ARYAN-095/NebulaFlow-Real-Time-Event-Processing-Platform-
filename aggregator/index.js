// aggregator/index.js
const { Kafka } = require("kafkajs");
const db = require("./db");
const { groupAndAverage } = require("./utils");

const kafka = new Kafka({ clientId: "aggregator", brokers: ["kafka:9092"] });
const consumer = kafka.consumer({ groupId: "aggregator-group" });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: "iot-sensor-data", fromBeginning: false });

  let buffer = [];

  // 1️⃣ Set up the 1‑minute flush interval
  setInterval(async () => {
    console.log(`\n⏳ Flushing buffer; ${buffer.length} records collected`);
    if (buffer.length === 0) {
      console.log("⚠️  No data this interval, skipping aggregation");
      return;
    }

    const aggregates = groupAndAverage(buffer);
    buffer = [];  // reset for next window

    for (const record of aggregates) {
      try {
        await db.insertAggregate(record);
        console.log("✅ Inserted aggregate:", record);
      } catch (err) {
        console.error("❌ Failed to insert aggregate:", record, err);
      }
    }
  }, 60_000);

  // 2️⃣ Consume messages into the buffer
  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value.toString();
      console.log("📨 Received message:", raw);
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return console.error("⚠️ Invalid JSON, skipping:", raw);
      }
      buffer.push(data);
    },
  });
}

start().catch(err => {
  console.error("Aggregator crashed:", err);
  process.exit(1);
});
