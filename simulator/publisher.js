// simulator/publisher.js
require('dotenv').config();
const mqtt  = require('mqtt');
const fetch = require('node-fetch');
const jwt   = require('jsonwebtoken');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const {
  MQTT_BROKER_URL = 'mqtt://localhost:1883',
  API_URL          = 'http://localhost:5000'
} = process.env;

// 1️⃣ Parse token from CLI or env
const argv = yargs(hideBin(process.argv))
  .option('token', { alias: 't', type: 'string', describe: 'Tenant JWT' })
  .help().argv;

const SIM_TOKEN = argv.token || process.env.SIM_TOKEN;
if (!SIM_TOKEN) {
  console.error('❌ Please provide a token via --token or SIM_TOKEN env');
  process.exit(1);
}

// 2️⃣ Decode to get tenant_id
let decoded;
try {
  decoded = jwt.decode(SIM_TOKEN);
  if (!decoded?.tenant_id) throw new Error();
} catch {
  console.error('❌ Invalid JWT, cannot extract tenant_id');
  process.exit(1);
}
const TENANT_ID = decoded.tenant_id;
console.log(`🔑 Simulating for tenant_id="${TENANT_ID}"`);

// 3️⃣ Fetch devices for this tenant
async function fetchDevices() {
  const res = await fetch(`${API_URL}/api/devices`, {
    headers: { Authorization: `Bearer ${SIM_TOKEN}` }
  });
  if (!res.ok) throw new Error(`GET /api/devices returned ${res.status}`);
  return res.json(); // [{ device_id, label, created_at }, ...]
}

// 4️⃣ Start the MQTT publisher
async function start() {
  const devices = await fetchDevices();
  if (!devices.length) {
    console.error('❌ No devices registered—please add one in the UI first.');
    process.exit(1);
  }
  console.log('🧩 Devices to simulate:', devices.map(d => d.device_id).join(', '));

  const client = mqtt.connect(MQTT_BROKER_URL);
  client.on('connect', () => console.log(`✅ MQTT connected to ${MQTT_BROKER_URL}`));

  let idx = 0;
  setInterval(() => {
    const dev = devices[idx];
    idx = (idx + 1) % devices.length;

    const payload = {
      deviceId:  dev.device_id,
      tenant_id: TENANT_ID,
      timestamp: Date.now(),
      temperature: +(20 + Math.random() * 10).toFixed(1),
      humidity:    +(40 + Math.random() * 20).toFixed(1),
    };

    client.publish('building/room1/data', JSON.stringify(payload), { qos: 1 }, err => {
      if (err) console.error('Publish error:', err);
    });

    console.log('🔸 Published →', payload);
  }, 2000);

  client.on('error', err => {
    console.error('MQTT Error:', err.message);
    client.end();
  });
}

start().catch(err => {
  console.error('❌ Simulator error:', err.message);
  process.exit(1);
});
