const prisma = require('../config/prisma');
const { nextSensorValue } = require('./sensor-values');
const { storeReadings, markStaleDevicesOffline } = require('../services/telemetry.service');
const { expirePendingCommands } = require('../services/device-command.service');
const { isDevicePaused } = require('./state');

const timers = [];
let started = false;

function runSafely(label, operation) {
  Promise.resolve(operation()).catch((error) => {
    console.error(`${label} failed:`, error);
  });
}

async function sendSimulatedHeartbeats() {
  const simulated = await prisma.devices.findMany({
    where: { device_code: { startsWith: 'sim-' } },
    select: { id: true },
  });
  const activeIds = simulated
    .filter((device) => !isDevicePaused(device.id))
    .map((device) => device.id);
  if (activeIds.length === 0) return;
  await prisma.devices.updateMany({
    where: { id: { in: activeIds } },
    data: { last_seen_at: new Date(), connection_status: 'online' },
  });
}

async function generateSimulatedReadings() {
  const devices = await prisma.devices.findMany({
    where: {
      device_code: { startsWith: 'sim-' },
      device_type: 'sensor',
    },
    include: {
      sensors: {
        include: {
          sensor_readings: { orderBy: { captured_at: 'desc' }, take: 1 },
        },
      },
    },
  });

  for (const device of devices) {
    if (isDevicePaused(device.id)) continue;
    const entries = device.sensors.map((sensor) => ({
      sensor,
      rawValue: nextSensorValue(sensor.sensor_type, sensor.sensor_readings[0]?.value),
    }));
    if (entries.length) await storeReadings(device, entries);
  }
}

function addInterval(label, operation, milliseconds) {
  const timer = setInterval(() => runSafely(label, operation), milliseconds);
  timer.unref?.();
  timers.push(timer);
}

function start() {
  if (started) return;
  started = true;

  const heartbeatMs = Math.max(Number(process.env.DEVICE_HEARTBEAT_SECONDS) || 5, 1) * 1000;
  const monitorMs = Math.min(heartbeatMs, 3000);

  // Áp dụng cho mọi device (kể cả board thật) — không được gate theo SIMULATOR_ENABLED.
  addInterval('Offline monitor', markStaleDevicesOffline, monitorMs);
  addInterval('Command timeout monitor', expirePendingCommands, monitorMs);

  if (process.env.SIMULATOR_ENABLED === 'false') return;

  const readingMs = Math.max(Number(process.env.SIMULATOR_READING_SECONDS) || 5, 1) * 1000;
  addInterval('Simulator heartbeat', sendSimulatedHeartbeats, heartbeatMs);
  addInterval('Simulator readings', generateSimulatedReadings, readingMs);
}

function stop() {
  while (timers.length) clearInterval(timers.pop());
  started = false;
}

module.exports = {
  start,
  stop,
  sendSimulatedHeartbeats,
  generateSimulatedReadings,
};
