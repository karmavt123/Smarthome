const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice } = require('./ownership.service');
const sseService = require('./sse.service');

function listDevices(userId, query = {}) {
  return prisma.devices.findMany({
    where: {
      homes: { user_id: Number(userId) },
      ...(query.home_id ? { home_id: Number(query.home_id) } : {}),
      ...(query.room_id ? { room_id: Number(query.room_id) } : {}),
      ...(query.device_type ? { device_type: query.device_type } : {}),
    },
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

  const device = await prisma.devices.create({
    data: { home_id, room_id, name, device_code, device_type },
  });

  sseService.publish(Number(userId), 'device_created', device);
  return device;
}

async function updateDevice(userId, deviceId, { name, room_id } = {}) {
  const device = await requireDevice(userId, deviceId);

  if (room_id != null) {
    const room = await prisma.rooms.findFirst({
      where: { id: Number(room_id), home_id: device.home_id },
    });
    if (!room) throw new HttpError(404, 'Room not found');
  }

  const updated = await prisma.devices.update({
    where: { id: device.id },
    data: {
      ...(name != null ? { name: String(name).trim() } : {}),
      ...(room_id !== undefined ? { room_id: room_id == null ? null : Number(room_id) } : {}),
    },
  });

  sseService.publish(Number(userId), 'device_updated', updated);
  return updated;
}

async function deleteDevice(userId, deviceId) {
  const device = await requireDevice(userId, deviceId);

  try {
    await prisma.devices.delete({ where: { id: device.id } });
  } catch (error) {
    if (error.code === 'P2003') {
      throw new HttpError(
        409,
        'Cannot delete a device that still has history (voice commands, or alert rules on its sensors) — remove those first'
      );
    }
    throw error;
  }

  sseService.publish(Number(userId), 'device_deleted', { id: device.id, home_id: device.home_id });
}

module.exports = { listDevices, getDeviceById, createDevice, updateDevice, deleteDevice };
