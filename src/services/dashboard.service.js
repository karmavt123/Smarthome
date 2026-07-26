const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { decorateSimulatorDevice } = require('../simulator/state');

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
          rooms: true,
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

  const environment = {};
  for (const device of home.devices) {
    for (const sensor of device.sensors) {
      const history = [...sensor.sensor_readings]
        .reverse()
        .map((reading) => ({
          value: Number(reading.value),
          captured_at: reading.captured_at,
          received_at: reading.created_at,
        }));
      environment[sensor.sensor_type] = {
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
    rooms: home.rooms,
    environment,
    environment_status: activeAlerts.some((alert) => alert.severity === 'critical')
      ? 'critical'
      : activeAlerts.length
        ? 'warning'
        : 'safe',
    devices: home.devices.map((rawDevice) => {
      const device = decorateSimulatorDevice(rawDevice);
      return {
        id: device.id,
        name: device.name,
        device_code: device.device_code,
        device_type: device.device_type,
        status: device.status,
        connection_status: device.connection_status,
        last_seen_at: device.last_seen_at,
        is_simulated: device.is_simulated,
        simulation_paused: device.simulation_paused,
        room: device.rooms,
      };
    }),
    alerts: home.alerts,
  };
}

module.exports = { getDashboard };
