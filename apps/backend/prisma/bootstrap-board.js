// Tao nha + 4 ban ghi thiet bi cho board Yolo:Bit that.
//   docker compose exec backend node prisma/bootstrap-board.js
// Idempotent: chay lai khong tao trung.

const prisma = require('../src/config/prisma');

const HOME_NAME = 'Nha that (Yolo:Bit)';

// Nguong CO CHU Y de rong: validateReading() nem loi neu gia tri ngoai [min,max]
// va CA GOI TIN bi bo. Dat chat qua = mat du lieu that tu cam bien.
const SENSORS = [
  { type: 'temperature', unit: 'do C', min: -10, max: 60 },
  { type: 'humidity', unit: '%', min: 0, max: 100 },
  { type: 'light', unit: 'lux', min: 0, max: 10000 },
];

const DEVICES = [
  ['yolobit-sensor', 'Cam bien Yolo:Bit', 'sensor', 'on'],
  ['yolobit-light', 'Den phong khach', 'light', 'off'],
  ['yolobit-fan', 'Quat phong khach', 'fan', 'off'],
  ['yolobit-door', 'Cua chinh', 'door', 'closed'],
];

async function main() {
  const admin = await prisma.users.findUnique({ where: { email: 'admin@admin.com' } });
  if (!admin) throw new Error('Chua co admin@admin.com - chay seed truoc');

  let home = await prisma.homes.findFirst({ where: { user_id: admin.id, name: HOME_NAME } });
  if (!home) {
    home = await prisma.homes.create({
      data: { user_id: admin.id, name: HOME_NAME, address: 'Board that qua MQTT' },
    });
  }

  let room = await prisma.rooms.findFirst({ where: { home_id: home.id, name: 'Phong khach' } });
  if (!room) {
    room = await prisma.rooms.create({ data: { home_id: home.id, name: 'Phong khach' } });
  }

  const created = {};
  for (const [code, name, type, status] of DEVICES) {
    let device = await prisma.devices.findFirst({ where: { device_code: code } });
    if (!device) {
      device = await prisma.devices.create({
        data: { home_id: home.id, room_id: room.id, name, device_code: code, device_type: type, status },
      });
    }
    created[code] = device;
  }

  for (const s of SENSORS) {
    const existing = await prisma.sensors.findFirst({
      where: { device_id: created['yolobit-sensor'].id, sensor_type: s.type },
    });
    if (!existing) {
      await prisma.sensors.create({
        data: {
          device_id: created['yolobit-sensor'].id,
          sensor_type: s.type,
          unit: s.unit,
          min_value: s.min,
          max_value: s.max,
        },
      });
    }
  }

  console.log(`Home id ${home.id} - "${HOME_NAME}"`);
  console.table(Object.values(created).map((d) => ({ id: d.id, code: d.device_code, name: d.name })));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
