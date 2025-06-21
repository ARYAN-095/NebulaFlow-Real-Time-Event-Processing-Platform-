function groupAndAverage(data) {
  const deviceMap = new Map();

  data.forEach(({ deviceId, temperature, humidity, tenant_id }) => {
    if (!deviceMap.has(deviceId)) {
      deviceMap.set(deviceId, { tempSum: 0, humSum: 0, count: 0, tenant_id });
    }
    const record = deviceMap.get(deviceId);
    record.tempSum += temperature;
    record.humSum += humidity;
    record.count += 1;
  });

  return Array.from(deviceMap.entries()).map(([deviceId, { tempSum, humSum, count, tenant_id }]) => ({
    device_id: deviceId,
    tenant_id,
    avg_temp: tempSum / count,
    avg_humidity: humSum / count,
    timestamp: new Date(),
  }));
}

module.exports = { groupAndAverage };
