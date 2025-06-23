require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const jwt         = require('express-jwt');
const { verify }  = require('jsonwebtoken');
const { Server }  = require('socket.io');
const format      = require('pg-format');

const { pool }               = require('./db');
const { startKafkaConsumer } = require('./kafka-consumer');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());

// 1️⃣ Protect HTTP routes with JWT
app.use(jwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  credentialsRequired: true,
  getToken: req => {
    const h = req.headers.authorization;
    return h && h.startsWith('Bearer ') ? h.slice(7) : null;
  },
}));

// 2️⃣ Inject tenant_id into Postgres session for RLS
app.use(async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Missing tenant_id');
    await pool.query(format("SET app.tenant_id = %L", tenantId));
    next();
  } catch (e) {
    console.error('Auth error:', e.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// 📦 Device Management API

// List devices
app.get('/api/devices', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT device_id, label, created_at
      FROM devices
      WHERE tenant_id = current_setting('app.tenant_id')
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/devices error:', e.message);
    res.status(500).json({ error: 'Could not fetch devices' });
  }
});

// Add a new device
app.post('/api/devices', async (req, res) => {
  const { device_id, label } = req.body;
  if (!device_id || !label) {
    return res.status(400).json({ error: 'device_id and label are required' });
  }
  try {
    await pool.query(`
      INSERT INTO devices(device_id, tenant_id, label)
      VALUES ($1, current_setting('app.tenant_id'), $2)
    `, [device_id, label]);
    res.status(201).end();
  } catch (e) {
    console.error('POST /api/devices error:', e.message);
    res.status(500).json({ error: 'Could not add device' });
  }
});

// Delete a device
app.delete('/api/devices/:id', async (req, res) => {
  try {
    await pool.query(`
      DELETE FROM devices
      WHERE device_id = $1
        AND tenant_id = current_setting('app.tenant_id')
    `, [req.params.id]);
    res.status(204).end();
  } catch (e) {
    console.error('DELETE /api/devices/:id error:', e.message);
    res.status(500).json({ error: 'Could not delete device' });
  }
});

// 🌡️ Sensor Data History API

app.get('/api/history', async (req, res) => {
  const minutes  = parseInt(req.query.since || '60', 10);
  const deviceId = req.query.device_id;

  const baseSQL = `
    SELECT
      timestamp   AS t,
      temperature AS temp,
      humidity    AS hum,
      device_id
    FROM sensor_data
    WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - $1
  `;
  const params = [ minutes * 60 * 1000 ];

  let sql = baseSQL;
  if (deviceId) {
    sql += ` AND device_id = $2`;
    params.push(deviceId);
  }
  sql += ` ORDER BY timestamp ASC`;

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/history error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔐 WebSocket Auth & RLS

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('No token provided');
    const payload = verify(token, process.env.JWT_SECRET);
    const tenantId = payload.tenant_id;
    if (!tenantId) throw new Error('No tenant_id in token');

    socket.tenantId = tenantId;
    const client = await pool.connect();
    await client.query(format("SET app.tenant_id = %L", tenantId));
    client.release();

    next();
  } catch (e) {
    console.error('Socket auth error:', e.message);
    next(new Error('Unauthorized'));
  }
});

// 🚚 Start Kafka Consumer & Emission
startKafkaConsumer(io);

// 🚀 Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
