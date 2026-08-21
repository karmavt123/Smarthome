const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');

async function requireRoom(userId, roomId) {
  const room = await prisma.rooms.findFirst({
    where: { id: Number(roomId), homes: { user_id: Number(userId) } },
  });
  if (!room) throw new HttpError(404, 'Room not found');
  return room;
}

async function listRooms(userId, homeId) {
  if (!homeId) throw new HttpError(400, 'homeId is required');
  const home = await requireHome(userId, homeId);
  return prisma.rooms.findMany({ where: { home_id: home.id }, orderBy: { id: 'asc' } });
}

async function createRoom(userId, { home_id, name }) {
  if (!home_id || !name) throw new HttpError(400, 'homeId and name are required');
  const home = await requireHome(userId, home_id);

  try {
    return await prisma.rooms.create({
      data: { home_id: home.id, name: String(name).trim() },
    });
  } catch (error) {
    if (error.code === 'P2002') throw new HttpError(409, 'Room name already exists in this home');
    throw error;
  }
}

async function updateRoom(userId, roomId, { name }) {
  const room = await requireRoom(userId, roomId);
  if (name == null) return room;

  try {
    return await prisma.rooms.update({
      where: { id: room.id },
      data: { name: String(name).trim() },
    });
  } catch (error) {
    if (error.code === 'P2002') throw new HttpError(409, 'Room name already exists in this home');
    throw error;
  }
}

async function deleteRoom(userId, roomId) {
  const room = await requireRoom(userId, roomId);
  await prisma.rooms.delete({ where: { id: room.id } });
}

module.exports = { listRooms, createRoom, updateRoom, deleteRoom };
