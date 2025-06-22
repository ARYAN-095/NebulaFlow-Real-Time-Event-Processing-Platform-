const { Pool } = require("pg");
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Validate environment variables
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
requiredEnvVars.forEach(env => {
  if (!process.env[env]) {
    throw new Error(`Missing required environment variable: ${env}`);
  }
});

// Configure connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection established successfully');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
})();

// Insert aggregate without `id`, with conflict handling
async function insertAggregate({ device_id, tenant_id, avg_temp, avg_humidity, timestamp }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO sensor_aggregates (device_id, tenant_id, avg_temp, avg_humidity, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id, timestamp)
       DO UPDATE SET
         avg_temp = EXCLUDED.avg_temp,
         avg_humidity = EXCLUDED.avg_humidity`
      ,
      [device_id, tenant_id, avg_temp, avg_humidity, timestamp]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting aggregate:', {
      error: err.message,
      params: { device_id, tenant_id, avg_temp, avg_humidity, timestamp }
    });
    throw err;
  } finally {
    client.release();
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database pool has ended');
  process.exit(0);
});

module.exports = {
  pool,
  insertAggregate
};
