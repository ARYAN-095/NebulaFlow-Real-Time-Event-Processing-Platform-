require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getRecentData } = require('./db');
const { startKafkaConsumer } = require('./kafka-consumer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());

// REST API - last X minutes of data
app.get('/api/history', async (req, res) => {
  const minutes = parseInt(req.query.since || '60');
  try {
    const data = await getRecentData(minutes);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Kafka → emit to WebSocket clients
startKafkaConsumer(io);

// Start server
const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 API listening on http://localhost:${PORT}`));
