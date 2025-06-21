// kafka-producer.js
require('dotenv').config();
const { KafkaClient, Producer } = require('kafka-node');

const kafkaHost = process.env.KAFKA_BROKER;
const topic     = process.env.KAFKA_TOPIC;

const client   = new KafkaClient({ kafkaHost });
const producer = new Producer(client);

producer.on('ready', () => {
  console.log(`✅ Kafka producer ready (broker=${kafkaHost})`);
});

producer.on('error', err => {
  console.error('Kafka Producer error:', err);
});

/**
 * Send a JS object to Kafka (auto-JSONified)
 */
function sendToKafka(message) {
  const payloads = [{ topic, messages: JSON.stringify(message) }];
  producer.send(payloads, (err, data) => {
    if (err) console.error('Kafka send error:', err);
    else console.log('✅ Sent to Kafka →', data);
  });
}

module.exports = { sendToKafka };
