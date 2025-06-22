// kafka-consumer.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { KafkaClient, Consumer } = require('kafka-node');
const { Client: PgClient } = require('pg');

const kafkaHost = process.env.KAFKA_BROKER;
const topic     = process.env.KAFKA_TOPIC;

const pgClient = new PgClient({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
   password: String(process.env.DB_PASSWORD),
});

console.log('🔍 Connecting with DB_USER:', process.env.DB_USER);
console.log('🔍 Connecting with DB_PASSWORD:', process.env.DB_PASSWORD);

pgClient.connect()
  .then(() => console.log('✅ Connected to TimescaleDB'))
  .catch(err => {
    console.error('Postgres connection error:', err);
    process.exit(1);
  });

// Ensure table exists
const createTable = `
CREATE TABLE IF NOT EXISTS sensor_data (
  id        SERIAL PRIMARY KEY,
  mqtt_topic TEXT,
  device_id  TEXT,
  timestamp  BIGINT,
  temperature REAL,
  humidity    REAL
);
`;
pgClient.query(createTable).catch(console.error);

// Kafka consumer
const client       = new KafkaClient({ kafkaHost });
const consumerOpts = { autoCommit: true, fromOffset: 'latest' };
const consumer     = new Consumer(client, [{ topic }], consumerOpts);

consumer.on('message', async ({ value }) => {
  try {
    const { mqttTopic, deviceId, tenant_id, timestamp, temperature, humidity } = JSON.parse(value);

  const insert = `
  INSERT INTO sensor_data
    (mqtt_topic, device_id, tenant_id, timestamp, temperature, humidity)
  VALUES
    ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (device_id, timestamp) DO NOTHING
`;
await pgClient.query(insert, [
  mqttTopic, deviceId, tenant_id, timestamp, temperature, humidity
]);
    console.log('📥 Inserted into DB:', { deviceId, timestamp });
  } catch (e) {
    console.error('Consumer processing error:', e);
  }
});

consumer.on('error', err => {
  console.error('Kafka Consumer error:', err);
});
