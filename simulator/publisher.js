// publisher.js
require('dotenv').config();
const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL;
const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log(`✅ MQTT connected to ${BROKER_URL}`);
  setInterval(() => {
    const payload = {
      deviceId: `sensor-${Math.ceil(Math.random() * 3)}`,
      timestamp: Date.now(),
      temperature: +(20 + Math.random() * 10).toFixed(1),
      humidity: +(40 + Math.random() * 20).toFixed(1)
    };
    // publish with qos 1
    client.publish(
      'building/room1/data',
      JSON.stringify(payload),
      { qos: 1 },
      err => {
        if (err) console.error('Publish error:', err);
      }
    );
    console.log('🔸 Published →', payload);
  }, 2000);
});

client.on('error', err => {
  console.error('MQTT Error:', err);
  client.end();
});
