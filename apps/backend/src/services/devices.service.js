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
  // Coerce ids the way every other service does. They arrive straight from req.body, so
  // a form sending "1" instead of 1 used to reach Prisma as a string and blow up with a
  // PrismaClientValidationError -> 500, instead of creating the device.
  const homeId = Number(home_id);
  const roomId = room_id === undefined || room_id === null ? null : Number(room_id);

  const home = await prisma.homes.findFirst({
    where: { id: homeId, user_id: Number(userId) },
  });
  if (!home) return null;

  if (roomId !== null) {
    const room = await prisma.rooms.findFirst({
      where: { id: roomId, home_id: homeId },
    });
    if (!room) return null;
  }

  const device = await prisma.devices.create({
    data: {
      home_id: homeId,
      room_id: roomId,
      name,
      device_code,
      device_type,
    },
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

  // A door with a PIN cannot be deleted, because deleting it is otherwise a way to REMOVE
  // that PIN without knowing it. Every FK to devices is ON DELETE CASCADE, so this one
  // request wipes door_passwords AND every door_access_log for the door; re-creating the
  // door then lets setDoorPin run its first-PIN path, which asks for no currentPin. Three
  // requests, and both the currentPin requirement and the 5-minute lockout are gone along
  // with the audit trail that would have shown it happening — exactly the borrowed-phone
  // attack those two controls exist to stop.
  // Clearing the PIN first is still possible, and that path does demand the current one.
  if (device.device_type === 'door') {
    const activePassword = await prisma.door_passwords.findFirst({
      where: { door_device_id: device.id, is_active: true },
      orderBy: { id: 'desc' },
    });
    if (activePassword) {
      throw new HttpError(
        409,
        'Cannot delete a door that still has a PIN — remove the PIN first (it requires the current one)'
      );
    }
  }

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
