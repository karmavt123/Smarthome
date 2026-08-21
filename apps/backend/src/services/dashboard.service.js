const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');

async function getDashboard(userId, homeId) {
  const where = {
    user_id: Number(userId),
    ...(homeId ? { id: Number(homeId) } : {}),
  };
  const home = await prisma.homes.findFirst({
    where,
    include: {
      rooms: { orderBy: { id: 'asc' } },
      devices: {
        orderBy: { id: 'asc' },
        include: {
          sensors: {
            include: {
              sensor_readings: { orderBy: { captured_at: 'desc' }, take: 12 },
            },
          },
        },
      },
      alerts: { orderBy: { created_at: 'desc' }, take: 10 },
    },
  });

  if (!home) throw new HttpError(404, 'Home not found. Bootstrap the simulator first.');

  const roomEnvironments = {};
  for (const device of home.devices) {
    for (const sensor of device.sensors) {
      if (!device.room_id) continue;
      const history = [...sensor.sensor_readings]
        .reverse()
        .map((reading) => ({
          value: Number(reading.value),
          captured_at: reading.captured_at,
          received_at: reading.created_at,
        }));
      const roomEnvironment = roomEnvironments[device.room_id] || (roomEnvironments[device.room_id] = {});
      roomEnvironment[sensor.sensor_type] = {
        sensor_id: sensor.id,
        value: history.at(-1)?.value ?? null,
        unit: sensor.unit,
        min_value: sensor.min_value == null ? null : Number(sensor.min_value),
        max_value: sensor.max_value == null ? null : Number(sensor.max_value),
        history,
      };
    }
  }

  const activeAlerts = home.alerts.filter((alert) => alert.status !== 'resolved');

  return {
    server_time: new Date(),
    home: { id: home.id, name: home.name, address: home.address },
    rooms: home.rooms.map((room) => ({
      ...room,
      environment: roomEnvironments[room.id] || {},
    })),
    environment_status: activeAlerts.some((alert) => alert.severity === 'critical')
      ? 'critical'
      : activeAlerts.length
        ? 'warning'
        : 'safe',
  };
}

module.exports = { getDashboard };
