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
