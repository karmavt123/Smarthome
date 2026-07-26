const prisma = require('../config/prisma');

function listDevices(userId) {
  return prisma.devices.findMany({
    where: { homes: { user_id: Number(userId) } },
    include: { rooms: true, sensors: true },
  });
}

function getDeviceById(userId, id) {
  return prisma.devices.findFirst({
    where: { id, homes: { user_id: Number(userId) } },
    include: { rooms: true, sensors: true },
  });
}

async function createDevice(userId, { home_id, room_id, name, device_code, device_type }) {
  const home = await prisma.homes.findFirst({
    where: { id: home_id, user_id: Number(userId) },
  });
  if (!home) return null;

  if (room_id) {
    const room = await prisma.rooms.findFirst({ where: { id: room_id, home_id } });
    if (!room) return null;
  }

  return prisma.devices.create({
    data: { home_id, room_id, name, device_code, device_type },
  });
}

module.exports = { listDevices, getDeviceById, createDevice };
