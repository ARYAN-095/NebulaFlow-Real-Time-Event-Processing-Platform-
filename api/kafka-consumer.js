// kafka-consumer.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { KafkaClient, Consumer } = require('kafka-node');

// Load and validate environment variables
const kafkaHost = process.env.KAFKA_BROKER;
const topic     = process.env.KAFKA_TOPIC;

if (!kafkaHost || !topic) {
  console.error('❌ Missing required env vars: KAFKA_BROKER or KAFKA_TOPIC');
  process.exit(1);
}

function startKafkaConsumer(io) {
  const client = new KafkaClient({ kafkaHost });

  const consumer = new Consumer(
    client,
    [{ topic, partition: 0 }],
    { autoCommit: true }
  );

  consumer.on('message', msg => {
    try {
      const { timestamp, temperature, humidity } = JSON.parse(msg.value);

      if (!timestamp || temperature === undefined || humidity === undefined) {
        console.warn('⚠️ Incomplete Kafka message payload:', msg.value);
        return;
      }

      io.emit('new_reading', {
        t: timestamp,
        temp: temperature,
        hum: humidity
      });
    } catch (err) {
      console.error('❌ Error parsing Kafka message:', err.message);
    }
  });

  consumer.on('message', msg => {
  const data = JSON.parse(msg.value);
  // Only emit to sockets matching this tenant
  io.sockets.sockets.forEach(socket => {
    if (socket.tenantId === data.tenant_id) {
      socket.emit('new_reading', { t: data.timestamp, temp: data.temperature, hum: data.humidity });
    }
  });
});

  console.log(`✅ Kafka consumer started for topic "${topic}"`);
}

module.exports = { startKafkaConsumer };
