const SENSOR_PROFILES = {
  temperature: { min: 20, max: 35, initial: 24, maxChange: 0.35 },
  humidity: { min: 35, max: 80, initial: 55, maxChange: 1.2 },
  light: { min: 0, max: 1000, initial: 350, maxChange: 40 },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max, random = Math.random) {
  return min + random() * (max - min);
}

function nextSensorValue(sensorType, previousValue, random = Math.random) {
  const profile = SENSOR_PROFILES[sensorType];
  if (!profile) throw new Error(`Unsupported sensor type: ${sensorType}`);

  const previous = Number.isFinite(Number(previousValue))
    ? Number(previousValue)
    : profile.initial;
  const change = randomBetween(-profile.maxChange, profile.maxChange, random);

  return Number(clamp(previous + change, profile.min, profile.max).toFixed(2));
}

module.exports = { SENSOR_PROFILES, clamp, randomBetween, nextSensorValue };
