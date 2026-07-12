const prisma = require('../config/prisma');

function listDevices() {
  return prisma.devices.findMany();
}

function getDeviceById(id) {
  return prisma.devices.findUnique({ where: { id } });
}

function createDevice({ home_id, room_id, name, device_code, device_type }) {
  return prisma.devices.create({
    data: { home_id, room_id, name, device_code, device_type },
  });
}

module.exports = { listDevices, getDeviceById, createDevice };
