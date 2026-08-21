const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');

const HISTORY_LIMIT = 12;

async function resolveHome(userId, homeId) {
  if (homeId) return requireHome(userId, homeId);

  const home = await prisma.homes.findFirst({
    where: { user_id: Number(userId) },
    orderBy: { id: 'asc' },
  });
  if (!home) throw new HttpError(404, 'No home found for this user');
  return home;
}

async function getEnvironment(userId, homeId) {
  const home = await resolveHome(userId, homeId);

  const sensors = await prisma.sensors.findMany({
    where: { devices: { home_id: home.id } },
    include: {
      sensor_readings: { orderBy: { captured_at: 'desc' }, take: HISTORY_LIMIT },
    },
  });

  const environment = {};
  for (const sensor of sensors) {
    const history = [...sensor.sensor_readings]
      .reverse()
      .map((reading) => ({
        value: Number(reading.value),
        captured_at: reading.captured_at,
        received_at: reading.created_at,
      }));

    environment[sensor.sensor_type] = {
      sensor_id: sensor.id,
      device_id: sensor.device_id,
      value: history.at(-1)?.value ?? null,
      unit: sensor.unit,
      min_value: sensor.min_value == null ? null : Number(sensor.min_value),
      max_value: sensor.max_value == null ? null : Number(sensor.max_value),
      history,
    };
  }

  return { home_id: home.id, server_time: new Date(), environment };
}

module.exports = { getEnvironment };
