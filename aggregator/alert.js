// alert.js
require('dotenv').config({ path: '../.env' });
const db = require('./db');
const { WebClient } = require('@slack/web-api');

if (!process.env.SLACK_TOKEN || !process.env.SLACK_CHANNEL) {
  console.warn('⚠️ SLACK_TOKEN or SLACK_CHANNEL not set—alerts will only log to console');
}
const slack = new WebClient(process.env.SLACK_TOKEN);

async function checkThresholds() {
  const result = await db.pool.query(
    `SELECT * FROM sensor_aggregates WHERE timestamp > NOW() - INTERVAL '2 minutes'`
  );

  for (const row of result.rows) {
    if (row.avg_temp > 10) {
      const alertMsg = `🚨 ALERT: High temperature on ${row.device_id} = ${row.avg_temp.toFixed(1)}°C`;
      console.log(alertMsg);

      if (process.env.SLACK_TOKEN && process.env.SLACK_CHANNEL) {
        try {
          await slack.chat.postMessage({
            channel: process.env.SLACK_CHANNEL,
            text: alertMsg,
          });
          console.log('✅ Slack notification sent');
        } catch (err) {
          console.error('❌ Failed to send Slack message:', err.message);
        }
      }
    }
  }
}

// Run every minute
setInterval(checkThresholds, 60_000);

// Also run immediately on start
checkThresholds().catch(err => {
  console.error('Alert check failed on startup:', err);
});
