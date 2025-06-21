const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});


console.log("🛠 DB config", {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: typeof process.env.DB_PASSWORD,
});


client.connect();

async function getRecentData(minutes) {
  const query = `
    SELECT timestamp, temperature, humidity
    FROM sensor_data
    WHERE timestamp > extract(epoch from now() - interval '${minutes} minutes') * 1000
    ORDER BY timestamp ASC
  `;
  const { rows } = await client.query(query);
  return rows.map(r => ({
    t: Number(r.timestamp),
    temp: r.temperature,
    hum: r.humidity
  }));
}

module.exports = { getRecentData };
