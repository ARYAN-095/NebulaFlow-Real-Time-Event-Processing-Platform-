const { Pool } = require("pg");
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
 host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function insertAggregate({ device_id, tenant_id, avg_temp, avg_humidity, timestamp }) {
  await pool.query(
    `INSERT INTO sensor_aggregates (device_id, tenant_id, avg_temp, avg_humidity, timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [device_id, tenant_id, avg_temp, avg_humidity, timestamp]
  );
}

module.exports = { insertAggregate };
