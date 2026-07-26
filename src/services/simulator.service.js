const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice } = require('./ownership.service');
const { storeReading } = require('./telemetry.service');
const { nextSensorValue } = require('../simulator/sensor-values');
const {
  isSimulatedDevice,
  setDeviceSimulationPaused,
  decorateSimulatorDevice,
} = require('../simulator/state');

const SIMULATION_HOME_NAME = 'Simulation Home';

async function upsertDevice(userId, homeId, roomId, suffix, data) {
  const deviceCode = `sim-${userId}-${suffix}`;
  return prisma.devices.upsert({
    where: { device_code: deviceCode },
    update: {
      home_id: homeId,
      room_id: roomId,
      name: data.name,
      device_type: data.device_type,
      connection_status: 'online',
      last_seen_at: new Date(),
    },
    create: {
      home_id: homeId,
      room_id: roomId,
      name: data.name,
      device_code: deviceCode,
      device_type: data.device_type,
      status: data.status,
      connection_status: 'online',
      last_seen_at: new Date(),
    },
  });
}

async function ensureSensor(deviceId, sensorType, unit, minValue, maxValue) {
  return prisma.sensors.upsert({
    where: { device_id_sensor_type: { device_id: deviceId, sensor_type: sensorType } },
    update: { unit, min_value: minValue, max_value: maxValue },
    create: {
      device_id: deviceId,
      sensor_type: sensorType,
      unit,
      min_value: minValue,
      max_value: maxValue,
    },
  });
}

async function ensureAlertRule(homeId, sensor, rule) {
  const existing = await prisma.alert_rules.findFirst({
    where: { home_id: homeId, sensor_id: sensor.id, name: rule.name },
  });
  if (existing) return existing;

  return prisma.alert_rules.create({
    data: {
      home_id: homeId,
      sensor_id: sensor.id,
      name: rule.name,
      condition_operator: rule.operator,
      threshold_value: rule.threshold,
      severity: rule.severity,
    },
  });
}

async function seedReading(sensor) {
  const count = await prisma.sensor_readings.count({ where: { sensor_id: sensor.id } });
  if (count > 0) return null;
  return storeReading(sensor, nextSensorValue(sensor.sensor_type, null, () => 0.5));
}

async function bootstrapSimulator(userId) {
  const numericUserId = Number(userId);
  let home = await prisma.homes.findFirst({
    where: { user_id: numericUserId, name: SIMULATION_HOME_NAME },
  });
  if (!home) {
    home = await prisma.homes.create({
      data: {
        user_id: numericUserId,
        name: SIMULATION_HOME_NAME,
        address: 'Local virtual environment',
      },
    });
  }

  let room = await prisma.rooms.findUnique({
    where: { home_id_name: { home_id: home.id, name: 'Living Room' } },
  });
  if (!room) {
    room = await prisma.rooms.create({
      data: { home_id: home.id, name: 'Living Room' },
    });
  }

  const environment = await upsertDevice(numericUserId, home.id, room.id, 'environment', {
    name: 'Environment Sensor',
    device_type: 'sensor',
    status: 'monitoring',
  });
  const light = await upsertDevice(numericUserId, home.id, room.id, 'light', {
    name: 'Living Room Light',
    device_type: 'light',
    status: 'off',
  });
  const fan = await upsertDevice(numericUserId, home.id, room.id, 'fan', {
    name: 'Living Room Fan',
    device_type: 'fan',
    status: 'off',
  });
  const door = await upsertDevice(numericUserId, home.id, room.id, 'door', {
    name: 'Front Door',
    device_type: 'door',
    status: 'closed',
  });
  for (const device of [environment, light, fan, door]) {
    setDeviceSimulationPaused(device.id, false);
  }

  const temperature = await ensureSensor(environment.id, 'temperature', 'C', -10, 60);
  const humidity = await ensureSensor(environment.id, 'humidity', '%', 0, 100);
  const lightLevel = await ensureSensor(environment.id, 'light', 'lux', 0, 2000);

  await ensureAlertRule(home.id, temperature, {
    name: 'High temperature',
    operator: 'gt',
    threshold: 30,
    severity: 'critical',
  });
  await ensureAlertRule(home.id, humidity, {
    name: 'High humidity',
    operator: 'gt',
    threshold: 75,
    severity: 'warning',
  });
  await ensureAlertRule(home.id, lightLevel, {
    name: 'Very low light',
    operator: 'lt',
    threshold: 20,
    severity: 'info',
  });

  const sensors = [temperature, humidity, lightLevel];
  for (const sensor of sensors) await seedReading(sensor);

  let faceProfile = await prisma.face_profiles.findFirst({
    where: { home_id: home.id, user_id: numericUserId, name: 'Demo Owner' },
  });
  if (!faceProfile) {
    faceProfile = await prisma.face_profiles.create({
      data: { home_id: home.id, user_id: numericUserId, name: 'Demo Owner' },
    });
  }

  const accessLogCount = await prisma.door_access_logs.count({
    where: { door_device_id: door.id },
  });
  if (accessLogCount === 0) {
    await prisma.door_access_logs.createMany({
      data: [
        {
          door_device_id: door.id,
          user_id: numericUserId,
          face_profile_id: faceProfile.id,
          access_method: 'face',
          result: 'success',
          confidence_score: 0.97,
        },
        {
          door_device_id: door.id,
          access_method: 'password',
          result: 'failed',
          failure_reason: 'Incorrect PIN',
        },
      ],
    });
  }

  return {
    home,
    room,
    devices: {
      environment: decorateSimulatorDevice(environment),
      light: decorateSimulatorDevice(light),
      fan: decorateSimulatorDevice(fan),
      door: decorateSimulatorDevice(door),
    },
    sensors,
    faceProfile,
  };
}

async function setDevicePaused(userId, deviceId, paused) {
  if (typeof paused !== 'boolean') throw new HttpError(400, 'paused must be a boolean');
  const device = await requireDevice(userId, deviceId);
  if (!isSimulatedDevice(device)) {
    throw new HttpError(400, 'Only simulated devices can be paused');
  }
  setDeviceSimulationPaused(device.id, paused);

  const updated = await prisma.devices.update({
    where: { id: device.id },
    data: {
      ...(paused
        ? {}
        : { last_seen_at: new Date(), connection_status: 'online' }),
    },
  });
  return decorateSimulatorDevice(updated);
}

module.exports = { SIMULATION_HOME_NAME, bootstrapSimulator, setDevicePaused };
