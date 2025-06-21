const { KafkaClient, Consumer } = require('kafka-node');

function startKafkaConsumer(io) {
  const client = new KafkaClient({ kafkaHost: process.env.KAFKA_BROKER });
  const consumer = new Consumer(client, [
    { topic: process.env.KAFKA_TOPIC, partition: 0 }
  ], { autoCommit: true });

  consumer.on('message', msg => {
    try {
      const { timestamp, temperature, humidity } = JSON.parse(msg.value);
      io.emit('new_reading', { t: timestamp, temp: temperature, hum: humidity });
    } catch (err) {
      console.error('Error parsing Kafka message:', err.message);
    }
  });

  consumer.on('error', err => console.error('Kafka consumer error:', err));
}

module.exports = { startKafkaConsumer };
