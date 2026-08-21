const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');

function listHomes(userId) {
  return prisma.homes.findMany({
    where: { user_id: Number(userId) },
    orderBy: { id: 'asc' },
  });
}

function createHome(userId, { name, address }) {
  if (!name) throw new HttpError(400, 'name is required');

  return prisma.homes.create({
    data: { user_id: Number(userId), name: String(name).trim(), address: address || null },
  });
}

async function updateHome(userId, homeId, { name, address }) {
  const home = await requireHome(userId, homeId);

  const data = {};
  if (name != null) data.name = String(name).trim();
  if (address !== undefined) data.address = address || null;

  return prisma.homes.update({ where: { id: home.id }, data });
}

async function deleteHome(userId, homeId) {
  const home = await requireHome(userId, homeId);
  await prisma.homes.delete({ where: { id: home.id } });
}

module.exports = { listHomes, createHome, updateHome, deleteHome };
