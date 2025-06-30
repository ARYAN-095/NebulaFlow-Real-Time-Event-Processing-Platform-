// server.js
require('dotenv').config();
const express       = require('express');
const http          = require('http');
const cors          = require('cors');
const jwt           = require('express-jwt');
const jsonwebtoken  = require('jsonwebtoken');
const { verify }    = require('jsonwebtoken');
const { Server }    = require('socket.io');
const format        = require('pg-format');
const Papa          = require('papaparse');
const promClient    = require('prom-client');
const DEFAULT_DEVICE_LABEL   = process.env.DEFAULT_DEVICE_LABEL || 'Demo Sensor';


const { pool }               = require('./db');
const { startKafkaConsumer } = require('./kafka-consumer');

////////////////////////////////////////////////////////////////////////////////
// 1️⃣ Prometheus instrumentation
    
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'iot_api_' });

const httpRequestsTotal = new promClient.Counter({
  name: 'iot_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'iot_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.3, 1.5, 5, 10],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

////////////////////////////////////////////////////////////////////////////////
// 2️⃣ App & HTTP server setup

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

////////////////////////////////////////////////////////////////////////////////
// 3️⃣ Metrics middleware – skip self-instrumentation

app.use((req, res, next) => {
  if (req.path === '/metrics') return next(); // 🛑 Skip /metrics to avoid recursion

  const end = httpRequestDurationSeconds.startTimer({ method: req.method, path: req.path });
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, path: req.path, status: res.statusCode });
    end({ method: req.method, path: req.path, status: res.statusCode });
  });
  next();
});

////////////////////////////////////////////////////////////////////////////////
// 4️⃣ Prometheus metrics endpoint

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

////////////////////////////////////////////////////////////////////////////////
// 5️⃣ Public APIs

app.post('/api/generate-token', async (req, res) => {
  const masterKey = req.headers['x-master-key'];
  if (masterKey !== process.env.MASTER_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { tenant_id } = req.body;
  if (!tenant_id) {
    return res.status(400).json({ error: 'tenant_id is required' });
  }

  // 3.1️⃣ Sign the JWT
  const token = jsonwebtoken.sign(
    { sub: `user-${tenant_id}`, tenant_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3.2️⃣ Ensure at least one device exists for this tenant
  const defaultDeviceId    = `${tenant_id}-sensor-1`;
  const defaultDeviceLabel = process.env.DEFAULT_DEVICE_LABEL || 'Demo Sensor';

  try {
    await pool.query(
      `INSERT INTO devices (device_id, tenant_id, label)
         VALUES ($1, $2, $3)
      ON CONFLICT (device_id, tenant_id) DO NOTHING;`,
      [defaultDeviceId, tenant_id, defaultDeviceLabel]
    );
    console.log(`[API] ensured default device for tenant=${tenant_id}`);
  } catch (err) {
    console.error(`[API] failed to insert default device: ${err.message}`);
  }

  return res.json({ token });
});

app.get('/api/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT tenant_id
      FROM devices
      ORDER BY tenant_id
    `);
    res.json(rows.map(r => r.tenant_id));
  } catch (e) {
    console.error(`GET /api/tenants error: ${e.message}`);
    res.status(500).json({ error: 'Could not fetch tenants' });
  }
});


////////////////////////////////////////////////////////////////////////////////
// 6️⃣ Auth middleware with JWT

app.use(jwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  credentialsRequired: true,
  getToken: req => {
    const h = req.headers.authorization;
    return h && h.startsWith('Bearer ') ? h.slice(7) : null;
  },
}));

app.use(async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    await pool.query(format("SET app.tenant_id = %L", tenantId));
    next();
  } catch (e) {
    console.error(`Auth/RLS error: ${e.message}`);
    res.status(401).json({ error: 'Unauthorized' });
  }
});


app.use(async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Missing tenant_id');
    await pool.query(format("SET app.tenant_id = %L", tenantId));
    next();
  } catch (e) {
    console.error('Auth/RLS error:', e.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 7️⃣ Device Management

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

app.delete('/api/devices/:id', async (req, res) => {
  try {
    await pool.query(`
      DELETE FROM devices
      WHERE device_id = $1
        AND tenant_id = current_setting('app.tenant_id')
    `, [req.params.id]);
    res.status(204).end();
  } catch (e) {
    console.error('DELETE /api/devices error:', e.message);
    res.status(500).json({ error: 'Could not delete device' });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 8️⃣ Sensor Data APIs

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
  const params = [minutes * 60 * 1000];
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

app.get('/api/aggregates', async (req, res) => {
  const minutes  = parseInt(req.query.since || '60', 10);
  const window   = req.query.window || '1 minute';
  const deviceId = req.query.device_id;
  const download = req.query.download === 'true';
  if (!['1 minute','5 minute'].includes(window)) {
    return res.status(400).json({ error: 'Invalid window' });
  }
  let sql = `
    SELECT
      time_bucket($1, timestamp) AS t,
      avg(avg_temp)     AS avg_temp,
      avg(avg_humidity) AS avg_humidity,
      device_id
    FROM sensor_aggregates
    WHERE timestamp > NOW() - INTERVAL '${minutes} minutes'
  `;
  const params = [window];
  if (deviceId) {
    sql += ` AND device_id = $2`;
    params.push(deviceId);
  }
  sql += ` GROUP BY t, device_id ORDER BY t ASC`;
  try {
    const { rows } = await pool.query(sql, params);
    if (download) {
      const csvData = rows.map(r => ({
        timestamp:    new Date(r.t).toISOString(),
        device_id:    r.device_id,
        avg_temp:     r.avg_temp.toFixed(2),
        avg_humidity: r.avg_humidity.toFixed(2),
      }));
      const csv = Papa.unparse(csvData);
      res.header('Content-Type','text/csv');
      res.header('Content-Disposition',
        `attachment; filename="aggregates_${deviceId||'all'}_${window.replace(' ','')}.csv"`);
      return res.send(csv);
    }
    res.json(rows.map(r => ({
      t:  new Date(r.t).getTime(),
      temp: Number(r.avg_temp),
      hum:  Number(r.avg_humidity),
      device_id: r.device_id
    })));
  } catch (e) {
    console.error('GET /api/aggregates error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 9️⃣ WebSocket auth

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('No token');
    const payload = verify(token, process.env.JWT_SECRET);
    const tenantId = payload.tenant_id;
    if (!tenantId) throw new Error('No tenant_id');
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

startKafkaConsumer(io);

////////////////////////////////////////////////////////////////////////////////
// 🔟 Start server

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
