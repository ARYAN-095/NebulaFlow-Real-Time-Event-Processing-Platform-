// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('express-jwt');
const { verify } = require('jsonwebtoken');
const { Server } = require('socket.io');
const format = require('pg-format');           // ← add pg-format

const { getRecentData, pool } = require('./db');
const { startKafkaConsumer } = require('./kafka-consumer');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// 1️⃣ Enable CORS
app.use(cors());

// 2️⃣ Protect HTTP routes with JWT
app.use(
  jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    credentialsRequired: true,
    getToken: req => {
      if (req.headers.authorization?.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
      }
      return null;
    },
  })
);

// 3️⃣ Inject tenant_id into session for RLS
app.use(async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Missing tenant_id in token');

    // Safely interpolate tenantId into the SET command
    const sql = format("SET app.tenant_id = %L", tenantId);
    await pool.query(sql);

    next();
  } catch (err) {
    console.error('❌ Auth error (HTTP):', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
});


// List devices for this tenant
app.get('/api/devices', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT device_id, label, created_at
       FROM devices
       WHERE tenant_id = current_setting('app.tenant_id')
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/devices error:', err.message);
    res.status(500).json({ error: 'Could not fetch devices' });
  }
});

// Add a new device
app.post('/api/devices', async (req, res) => {
  const { device_id, label } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  if ( !label) {
    return res.status(400).json({ error: 'label required' });
  }

  try {
    await pool.query(
      `INSERT INTO devices(device_id, tenant_id, label)
       VALUES ($1, current_setting('app.tenant_id'), $2)`,
      [device_id, label || null]
    );
    res.status(201).end();
  } catch (err) {
    console.error('❌ POST /api/devices error:', err.message);
    res.status(500).json({ error: 'Could not add device' });
  }
});

// Remove a device
app.delete('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `DELETE FROM devices
       WHERE device_id = $1
         AND tenant_id = current_setting('app.tenant_id')`,
      [id]
    );
    res.status(204).end();
  } catch (err) {
    console.error('❌ DELETE /api/devices/:id error:', err.message);
    res.status(500).json({ error: 'Could not delete device' });
  }
});



// 4️⃣ Protected REST route to get recent data
app.get('/api/history', async (req, res) => {
  const minutes = parseInt(req.query.since || '60', 10);
  try {
    const data = await getRecentData(minutes);
    res.json(data);
  } catch (e) {
    console.error('❌ Error fetching history:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5️⃣ WebSocket auth and RLS injection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('No auth token provided');

    const payload = verify(token, process.env.JWT_SECRET);
    const tenantId = payload.tenant_id;
    if (!tenantId) throw new Error('No tenant_id in token');

    socket.tenantId = tenantId;

    // Safely set the tenant for this socket session
    const client = await pool.connect();
    const sql = format("SET app.tenant_id = %L", tenantId);
    await client.query(sql);
    client.release();

    next();
  } catch (err) {
    console.error('❌ Socket auth error:', err.message);
    next(new Error('Unauthorized'));
  }
});

// 6️⃣ Start Kafka Consumer
startKafkaConsumer(io);

// 7️⃣ Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
