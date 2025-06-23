require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { KafkaClient, Consumer } = require('kafka-node');
const { Client: PgClient } = require('pg');

const config = {
  kafka: {
    host: process.env.KAFKA_BROKER || 'localhost:9092',
    topic: process.env.KAFKA_TOPIC || 'iot-sensor-data',
    options: {
      autoCommit: true,
      fromOffset: 'latest'
    }
  },
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'iot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1234'
  }
};

async function runConsumer() {
  const pgClient = new PgClient(config.postgres);
  
  try {
    // Database connection
    await pgClient.connect();
    console.log('✅ Connected to TimescaleDB');

    // Fixed table creation query
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        mqtt_topic TEXT,
        device_id TEXT,
        tenant_id TEXT,
        timestamp BIGINT,
        temperature REAL,
        humidity REAL,
        UNIQUE(device_id, timestamp)
      )
    `);
    console.log('✔ Verified sensor_data table exists');

    // Kafka consumer setup
    const client = new KafkaClient({
      kafkaHost: config.kafka.host,
      connectTimeout: 10000,
      requestTimeout: 30000
    });

    const consumer = new Consumer(
      client,
      [{ topic: config.kafka.topic }],
      config.kafka.options
    );

    consumer.on('message', async (message) => {
      try {
        const data = JSON.parse(message.value);
        await pgClient.query(`
          INSERT INTO sensor_data
            (mqtt_topic, device_id, tenant_id, timestamp, temperature, humidity)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (device_id, timestamp) DO NOTHING
        `, [
          data.mqttTopic, 
          data.deviceId, 
          data.tenant_id, 
          data.timestamp, 
          data.temperature, 
          data.humidity
        ]);
        console.log(`📥 Inserted data from ${data.deviceId}`);
      } catch (err) {
        console.error('Message processing error:', err);
      }
    });

    consumer.on('error', err => {
      console.error('Kafka Consumer Error:', err);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      consumer.close(true, async () => {
        await pgClient.end();
        process.exit();
      });
    });

    console.log('🚀 Consumer is now running...');
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

runConsumer();