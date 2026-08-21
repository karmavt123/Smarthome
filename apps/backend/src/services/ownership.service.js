const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');

async function requireHome(userId, homeId) {
  const home = await prisma.homes.findFirst({
    where: { id: Number(homeId), user_id: Number(userId) },
  });

  if (!home) throw new HttpError(404, 'Home not found');
  return home;
}

async function requireDevice(userId, deviceId, include) {
  const device = await prisma.devices.findFirst({
    where: { id: Number(deviceId), homes: { user_id: Number(userId) } },
    include,
  });

  if (!device) throw new HttpError(404, 'Device not found');
  return device;
}

async function requireSensor(userId, sensorId, include) {
  const sensor = await prisma.sensors.findFirst({
    where: {
      id: Number(sensorId),
      devices: { homes: { user_id: Number(userId) } },
    },
    include,
  });

  if (!sensor) throw new HttpError(404, 'Sensor not found');
  return sensor;
}

module.exports = { requireHome, requireDevice, requireSensor };
