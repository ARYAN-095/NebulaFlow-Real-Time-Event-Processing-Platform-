const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

console.log("🛠 DB config", {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: typeof process.env.DB_PASSWORD,
});

pool.connect();

async function getRecentData(minutes) {
  const query = `
    SELECT timestamp, temperature, humidity
    FROM sensor_data
    WHERE timestamp > extract(epoch from now() - interval '${minutes} minutes') * 1000
    ORDER BY timestamp ASC
  `;
  const { rows } = await pool.query(query);
  return rows.map(r => ({
    t: Number(r.timestamp),
    temp: r.temperature,
    hum: r.humidity
  }));
}

module.exports = {
  pool,
  getRecentData
};

