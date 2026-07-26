const {
  SENSOR_PROFILES,
  randomBetween,
  nextSensorValue,
} = require('../src/simulator/sensor-values');

describe('simulated sensor values', () => {
  test('randomBetween respects both limits', () => {
    expect(randomBetween(10, 20, () => 0)).toBe(10);
    expect(randomBetween(10, 20, () => 1)).toBe(20);
  });

  test.each(Object.entries(SENSOR_PROFILES))(
    '%s remains bounded and changes gradually',
    (sensorType, profile) => {
      const increase = nextSensorValue(sensorType, profile.max - 0.01, () => 1);
      const decrease = nextSensorValue(sensorType, profile.min + 0.01, () => 0);

      expect(increase).toBeLessThanOrEqual(profile.max);
      expect(decrease).toBeGreaterThanOrEqual(profile.min);
      expect(Math.abs(increase - (profile.max - 0.01))).toBeLessThanOrEqual(
        profile.maxChange + 0.01
      );
    }
  );
});
