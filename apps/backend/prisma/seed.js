const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');
const alertEvaluationService = require('../src/services/alert-evaluation.service');

const SEED_PREFIX = 'Seed:';
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;
const READINGS_PER_DAY = 48; // mỗi 30 phút
const COMMANDS_PER_DEVICE_PER_DAY = 4;

const CONTROL_METHODS = ['app', 'voice', 'face', 'automatic', 'manual'];
const COMMAND_STATUSES = ['executed', 'executed', 'executed', 'failed', 'expired'];
const ACTIONS_BY_DEVICE_TYPE = {
  light: ['turn_on', 'turn_off', 'set_color'],
  fan: ['turn_on', 'turn_off', 'set_speed'],
  door: ['open', 'close'],
};

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function daysAgo(days, hours = 0, minutes = 0) {
  return new Date(Date.now() - days * DAY_MS - hours * 60 * 60 * 1000 - minutes * 60 * 1000);
}

function readingsFor(sensorType) {
  const ranges = {
    temperature: [24, 30],
    humidity: [40, 70],
    light: [100, 800],
  };
  const [min, max] = ranges[sensorType];
  const now = Date.now();
  const stepMs = DAY_MS / READINGS_PER_DAY;
  const totalPoints = HISTORY_DAYS * READINGS_PER_DAY;
  return Array.from({ length: totalPoints }, (_, i) => ({
    value: Number((min + Math.random() * (max - min)).toFixed(2)),
    captured_at: new Date(now - (totalPoints - 1 - i) * stepMs),
  }));
}

async function seedSensor(deviceId, sensorType, unit, minValue, maxValue) {
  const sensor = await prisma.sensors.create({
    data: { device_id: deviceId, sensor_type: sensorType, unit, min_value: minValue, max_value: maxValue },
  });

  const telemetry = await prisma.telemetry_messages.create({
    data: { device_id: deviceId, message_id: `seed-${deviceId}-${sensorType}`, captured_at: new Date() },
  });

  await prisma.sensor_readings.createMany({
    data: readingsFor(sensorType).map((r) => ({
      sensor_id: sensor.id,
      telemetry_message_id: telemetry.id,
      value: r.value,
      captured_at: r.captured_at,
    })),
  });

  return sensor;
}

async function seedDeviceCommands(userId, device) {
  const actions = ACTIONS_BY_DEVICE_TYPE[device.device_type];
  if (!actions) return; // sensor devices không nhận command

  const data = [];
  for (let day = 0; day < HISTORY_DAYS; day++) {
    for (let i = 0; i < COMMANDS_PER_DEVICE_PER_DAY; i++) {
      const action = randomFrom(actions);
      const status = randomFrom(COMMAND_STATUSES);
      const createdAt = daysAgo(day, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      const value = action === 'set_speed'
        ? Math.floor(Math.random() * 5) * 25
        : action === 'set_color'
          ? `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
          : null;

      data.push({
        id: crypto.randomUUID(),
        device_id: device.id,
        user_id: userId,
        action,
        ...(value == null ? {} : { value }),
        control_method: randomFrom(CONTROL_METHODS),
        status,
        failure_reason: status === 'failed' ? 'Simulated device rejected the command' : null,
        created_at: createdAt,
        acknowledged_at: new Date(createdAt.getTime() + 800),
        expires_at: new Date(createdAt.getTime() + 30 * 1000),
      });
    }
  }

  await prisma.device_commands.createMany({ data });
}

function alertContent(alertType, severity, homeName) {
  const bySeverity = { critical: 'nghiêm trọng', warning: 'cảnh báo', info: 'cần chú ý' };
  const map = {
    environment: {
      title: 'Cảnh báo môi trường',
      message: `Chỉ số môi trường tại ${homeName} ở mức ${bySeverity[severity]}.`,
    },
    device_offline: {
      title: 'Thiết bị mất kết nối',
      message: `Một thiết bị tại ${homeName} vừa offline (${bySeverity[severity]}).`,
    },
    unauthorized_access: {
      title: 'Truy cập trái phép',
      message: `Phát hiện truy cập bất thường tại ${homeName} (${bySeverity[severity]}).`,
    },
  };
  return map[alertType];
}

function seedAlertsData(homeId, homeName, perSeverity) {
  const severities = ['critical', 'warning', 'info'];
  // 'unauthorized_access' is deliberately not in this random pool — it's seeded
  // separately by seedUnauthorizedAccessAlert() using the real detection logic,
  // so its shape (message tag, linked notification) matches production exactly.
  const alertTypes = ['environment', 'device_offline'];
  const statuses = ['unread', 'read', 'resolved'];
  const data = [];

  for (const severity of severities) {
    for (let i = 0; i < perSeverity; i++) {
      const alertType = randomFrom(alertTypes);
      const content = alertContent(alertType, severity, homeName);
      const createdAt = daysAgo(Math.floor(Math.random() * HISTORY_DAYS), Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      data.push({
        home_id: homeId,
        alert_type: alertType,
        severity,
        title: content.title,
        message: content.message,
        status: randomFrom(statuses),
        created_at: createdAt,
      });
    }
  }

  return data;
}

// Seeds 3 failed face-unlock attempts clustered inside the 2-minute lockout window,
// then runs the real evaluateDoorAccessFailures() detection — so the resulting alert
// + notification are byte-for-byte what production creates (title, message tag,
// severity, channel), not a hand-rolled approximation that can drift from the code.
async function seedUnauthorizedAccessAlert(doorDevice) {
  const now = Date.now();
  await prisma.door_access_logs.createMany({
    data: [100, 70, 40].map((secondsAgo) => ({
      door_device_id: doorDevice.id,
      access_method: 'face',
      result: 'failed',
      failure_reason: 'No matching face profile within threshold',
      created_at: new Date(now - secondsAgo * 1000),
    })),
  });

  await alertEvaluationService.evaluateDoorAccessFailures(doorDevice, 'face');
}

async function seedHome(userId, { name, address, rooms, alertsPerSeverity }) {
  const home = await prisma.homes.create({
    data: { user_id: userId, name: `${SEED_PREFIX} ${name}`, address },
  });

  const roomMap = {};
  for (const roomName of Object.keys(rooms)) {
    const room = await prisma.rooms.create({ data: { home_id: home.id, name: roomName } });
    roomMap[roomName] = room.id;
  }

  const devicesByCode = {};
  for (const [roomName, roomDevices] of Object.entries(rooms)) {
    for (const dev of roomDevices) {
      const device = await prisma.devices.create({
        data: {
          home_id: home.id,
          room_id: roomMap[roomName],
          name: dev.name,
          device_code: dev.code,
          device_type: dev.type,
          status: dev.status,
          connection_status: dev.connection,
        },
      });
      devicesByCode[dev.code] = device;

      await seedDeviceCommands(userId, device);

      for (const sensor of dev.sensors || []) {
        await seedSensor(device.id, sensor.type, sensor.unit, sensor.min, sensor.max);
      }
    }
  }

  await prisma.alerts.createMany({
    data: seedAlertsData(home.id, name, alertsPerSeverity),
  });

  const doorDevice = Object.values(devicesByCode).find((d) => d.device_type === 'door');
  if (doorDevice) await seedUnauthorizedAccessAlert(doorDevice);

  return home;
}

async function main() {
  const password_hash = await bcrypt.hash('password', 10);

  const admin = await prisma.users.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      full_name: 'Admin',
      email: 'admin@admin.com',
      password_hash,
      role: 'admin',
    },
  });

  // Dọn seed cũ (cascade xoá luôn rooms/devices/sensors/sensor_readings/device_commands/alerts con của home)
  await prisma.homes.deleteMany({ where: { user_id: admin.id, name: { startsWith: SEED_PREFIX } } });

  const home1 = await seedHome(admin.id, {
    name: 'Nhà chính',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    alertsPerSeverity: 5,
    rooms: {
      'Phòng khách': [
        { name: 'Đèn phòng khách', code: 'seed-h1-livingroom-light', type: 'light', status: 'on', connection: 'online' },
        {
          name: 'Cảm biến phòng khách',
          code: 'seed-h1-livingroom-sensor',
          type: 'sensor',
          status: 'on',
          connection: 'online',
          sensors: [
            { type: 'temperature', unit: '°C', min: 18, max: 35 },
            { type: 'humidity', unit: '%', min: 20, max: 90 },
          ],
        },
      ],
      'Phòng ngủ': [
        { name: 'Quạt phòng ngủ', code: 'seed-h1-bedroom-fan', type: 'fan', status: 'off', connection: 'offline' },
      ],
      'Nhà bếp': [
        { name: 'Cửa nhà bếp', code: 'seed-h1-kitchen-door', type: 'door', status: 'closed', connection: 'online' },
        {
          name: 'Cảm biến ánh sáng bếp',
          code: 'seed-h1-kitchen-sensor',
          type: 'sensor',
          status: 'on',
          connection: 'online',
          sensors: [{ type: 'light', unit: 'lux', min: 0, max: 1000 }],
        },
      ],
    },
  });

  const home2 = await seedHome(admin.id, {
    name: 'Nhà villa',
    address: '456 Đường XYZ, Quận 7, TP.HCM',
    alertsPerSeverity: 3,
    rooms: {
      'Phòng khách': [
        { name: 'Đèn phòng khách villa', code: 'seed-h2-livingroom-light', type: 'light', status: 'on', connection: 'online' },
      ],
      'Sân vườn': [
        { name: 'Cửa sân vườn', code: 'seed-h2-garden-door', type: 'door', status: 'closed', connection: 'offline' },
        {
          name: 'Cảm biến sân vườn',
          code: 'seed-h2-garden-sensor',
          type: 'sensor',
          status: 'on',
          connection: 'online',
          sensors: [{ type: 'temperature', unit: '°C', min: 15, max: 40 }],
        },
      ],
    },
  });

  console.log('Seeded user id:', admin.id);
  console.log('Seeded home ids:', [home1.id, home2.id]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
