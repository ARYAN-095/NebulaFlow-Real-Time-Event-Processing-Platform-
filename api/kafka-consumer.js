// kafka-consumer.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { KafkaClient, Consumer } = require('kafka-node');

/**
 * Starts a Kafka consumer that pushes readings to Socket.IO clients.
 * @param {import('socket.io').Server} io
 */
function startKafkaConsumer(io) {
  const kafkaHost = process.env.KAFKA_BROKER;
  const topic     = process.env.KAFKA_TOPIC;

  if (!kafkaHost || !topic) {
    console.error('❌ Missing env vars: KAFKA_BROKER or KAFKA_TOPIC');
    process.exit(1);
  }

  const client   = new KafkaClient({ kafkaHost });
  const consumer = new Consumer(
    client,
    [{ topic, partition: 0 }],
    { autoCommit: true, fromOffset: 'latest' }
  );

  consumer.on('message', msg => {
    let data;
    try {
      data = JSON.parse(msg.value);
    } catch (err) {
      console.error('❌ Error parsing Kafka message JSON:', err.message);
      return;
    }

    const { deviceId, tenant_id, timestamp, temperature, humidity } = data;

    // Validate required fields
    if (!deviceId || !tenant_id || !timestamp || temperature == null || humidity == null) {
      console.warn('⚠️ Incomplete payload, skipping:', data);
      return;
    }

    // Build the payload your frontend expects
    const payload = {
      deviceId,
      t: timestamp,
      temp: temperature,
      hum: humidity
    };

    // Emit only to sockets belonging to this tenant
    // io.sockets.sockets is a Map in Socket.IO v4
    io.sockets.sockets.forEach(socket => {
      if (socket.tenantId === tenant_id) {
        socket.emit('new_reading', payload);
      }
    });
  });

  consumer.on('error', err => {
    console.error('❌ Kafka consumer error:', err.message);
  });

  console.log(`✅ Kafka consumer started for topic "${topic}"`);
}

module.exports = { startKafkaConsumer };
