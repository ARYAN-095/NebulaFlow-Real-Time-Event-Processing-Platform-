// subscriber.js
require('dotenv').config();
const mqtt = require('mqtt');
const { sendToKafka } = require('./kafka-producer');

const mqttUrl = process.env.MQTT_BROKER_URL;
const topicFilter = 'building/#';

const client = mqtt.connect(mqttUrl);

client.on('connect', () => {
  console.log(`✅ MQTT subscriber connected to ${mqttUrl}`);
  client.subscribe(topicFilter, { qos: 1 }, err => {
    if (err) console.error('Subscribe error:', err);
    else console.log(`🔔 Subscribed to MQTT topic '${topicFilter}'`);
  });
});

client.on('message', (topic, msgBuffer) => {
  try {
    const payload = JSON.parse(msgBuffer.toString());
    // attach original MQTT topic
    payload.mqttTopic = topic;
    sendToKafka(payload);
  } catch (e) {
    console.error('Message parsing error:', e);
  }
});

client.on('error', err => {
  console.error('MQTT Subscriber error:', err);
  client.end();
});
