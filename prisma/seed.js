const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const SEED_PREFIX = 'Seed:';

function readingsFor(sensorType) {
  const ranges = {
    temperature: [24, 30],
    humidity: [40, 70],
    light: [100, 800],
  };
  const [min, max] = ranges[sensorType];
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    value: Number((min + Math.random() * (max - min)).toFixed(2)),
    captured_at: new Date(now - (11 - i) * 5 * 60 * 1000),
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

async function seedHome(userId, { name, address, rooms }) {
  const home = await prisma.homes.create({
    data: { user_id: userId, name: `${SEED_PREFIX} ${name}`, address },
  });

  const roomMap = {};
  for (const roomName of Object.keys(rooms)) {
    const room = await prisma.rooms.create({ data: { home_id: home.id, name: roomName } });
    roomMap[roomName] = room.id;
  }

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

      for (const sensor of dev.sensors || []) {
        await seedSensor(device.id, sensor.type, sensor.unit, sensor.min, sensor.max);
      }
    }
  }

  await prisma.alerts.createMany({
    data: [
      {
        home_id: home.id,
        alert_type: 'environment',
        severity: 'warning',
        title: 'Nhiệt độ cao bất thường',
        message: `Nhiệt độ tại ${name} vượt ngưỡng cảnh báo.`,
        status: 'unread',
      },
      {
        home_id: home.id,
        alert_type: 'device_offline',
        severity: 'info',
        title: 'Thiết bị mất kết nối',
        message: `Một thiết bị tại ${name} vừa offline.`,
        status: 'read',
      },
    ],
  });

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

  // Dọn seed cũ (cascade xoá luôn rooms/devices/sensors/alerts con của home)
  await prisma.homes.deleteMany({ where: { user_id: admin.id, name: { startsWith: SEED_PREFIX } } });

  const home1 = await seedHome(admin.id, {
    name: 'Nhà chính',
    address: '123 Đường ABC, Quận 1, TP.HCM',
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
