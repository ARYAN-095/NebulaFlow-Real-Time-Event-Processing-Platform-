const db = require("./db");
const { WebClient } = require("@slack/web-api");
const slack = new WebClient("your_slack_token");

async function checkThresholds() {
  const result = await db.pool.query(
    `SELECT * FROM sensor_aggregates WHERE timestamp > NOW() - INTERVAL '2 minutes'`
  );

  result.rows.forEach(row => {
    if (row.avg_temp > 30) {
      console.log(`🚨 ALERT: High temperature on ${row.device_id} = ${row.avg_temp}`);

      // Optional Slack integration
      slack.chat.postMessage({
        channel: "#alerts",
        text: `🔥 Device ${row.device_id} exceeded temperature: ${row.avg_temp.toFixed(1)}°C`,
      });
    }
  });
}

setInterval(checkThresholds, 60_000); // every 1 min
