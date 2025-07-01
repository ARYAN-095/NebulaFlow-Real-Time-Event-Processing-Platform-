const { groupAndAverage } = require('../utils');

describe('groupAndAverage', () => {
  it('groups multiple readings by deviceId and averages correctly', () => {
    const input = [
      { deviceId: 'd1', temperature: 10, humidity: 20, tenant_id: 't1' },
      { deviceId: 'd1', temperature: 14, humidity: 26, tenant_id: 't1' },
      { deviceId: 'd2', temperature: 25, humidity: 40, tenant_id: 't1' },
    ];
    const out = groupAndAverage(input);

    // find d1
    const d1 = out.find(r => r.device_id === 'd1');
    expect(d1).toBeDefined();
    expect(d1.avg_temp).toBeCloseTo((10 + 14) / 2);
    expect(d1.avg_humidity).toBeCloseTo((20 + 26) / 2);
    expect(d1.tenant_id).toBe('t1');

    // find d2
    const d2 = out.find(r => r.device_id === 'd2');
    expect(d2).toBeDefined();
    expect(d2.avg_temp).toBeCloseTo(25);
    expect(d2.avg_humidity).toBeCloseTo(40);
    expect(d2.tenant_id).toBe('t1');
  });
});
