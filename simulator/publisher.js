// simulator/publisher.js
require('dotenv').config();
const mqtt  = require('mqtt');
const fetch = require('node-fetch');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const {
  MQTT_BROKER_URL = 'mqtt://localhost:1883',
  API_URL          = 'http://localhost:5000',
  MASTER_KEY       = ''
} = process.env;

// 1️⃣ Parse tenant from CLI or env
const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    alias: 't',
    type: 'string',
    describe: 'Tenant ID to simulate',
    demandOption: true
  })
  .help().argv;

const TENANT_ID = argv.tenant;

// 2️⃣ Fetch a JWT for this tenant
async function fetchToken() {
  const res = await fetch(`${API_URL}/api/generate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-master-key': MASTER_KEY
    },
    body: JSON.stringify({ tenant_id: TENANT_ID })
  });
  if (!res.ok) {
    throw new Error(`Token endpoint returned ${res.status}`);
  }
  const { token } = await res.json();
  return token;
}

// 3️⃣ Fetch the devices for this tenant
async function fetchDevices(token) {
  const res = await fetch(`${API_URL}/api/devices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`GET /api/devices returned ${res.status}`);
  }
  return res.json(); // [{ device_id, label, created_at }, ...]
}

// 4️⃣ Start publishing loop
async function start() {
  if (!MASTER_KEY) {
    console.error('❌ MASTER_KEY env is required');
    process.exit(1);
  }

  console.log(`🔑 Requesting token for tenant_id="${TENANT_ID}"`);
  const token = await fetchToken();
  console.log('✅ Received token');

  const devices = await fetchDevices(token);
  if (!devices.length) {
    console.error('❌ No devices registered—add one in the UI first.');
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
    console.error('❌ MQTT Error:', err.message);
    client.end();
  });
}

start().catch(err => {
  console.error('❌ Simulator error:', err.message);
  process.exit(1);
});
