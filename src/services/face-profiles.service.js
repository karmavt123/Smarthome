const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');
const { computeFaceDescriptor } = require('./face-recognition.service');
const { saveFaceImage, deleteFaceImage } = require('../utils/face-image-storage');

function present(profile) {
  if (!profile) return profile;
  const { face_embedding, ...rest } = profile;
  return rest;
}

async function createFaceProfile(userId, payload, file) {
  const { home_id: homeId, name } = payload;
  if (!homeId) throw new HttpError(400, 'homeId is required');
  if (!name) throw new HttpError(400, 'name is required');
  if (!file) throw new HttpError(400, 'image file is required');

  await requireHome(userId, homeId);

  const embedding = await computeFaceDescriptor(file.buffer);
  const relativePath = saveFaceImage(file.buffer, file.mimetype);

  const profile = await prisma.face_profiles.create({
    data: {
      home_id: Number(homeId),
      user_id: Number(userId),
      name,
      image_url: relativePath,
      face_embedding: JSON.stringify(embedding),
      is_active: true,
    },
  });

  return present(profile);
}

async function listFaceProfiles(userId, query = {}) {
  const { home_id: homeId } = query;
  if (!homeId) throw new HttpError(400, 'homeId is required');
  await requireHome(userId, homeId);

  const profiles = await prisma.face_profiles.findMany({
    where: { home_id: Number(homeId) },
    orderBy: { created_at: 'desc' },
  });
  return profiles.map(present);
}

async function deleteFaceProfile(userId, id) {
  const profile = await prisma.face_profiles.findFirst({
    where: { id: Number(id), homes: { user_id: Number(userId) } },
  });
  if (!profile) throw new HttpError(404, 'Face profile not found');

  await prisma.face_profiles.delete({ where: { id: profile.id } });
  deleteFaceImage(profile.image_url);
}

module.exports = { present, createFaceProfile, listFaceProfiles, deleteFaceProfile };
