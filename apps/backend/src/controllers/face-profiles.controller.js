const humps = require('humps');
const faceProfilesService = require('../services/face-profiles.service');
const { faceImageUrl } = require('../utils/face-image-storage');
const serialize = require('../utils/serialize');

function withAbsoluteImageUrl(req, profile) {
  return { ...profile, image_url: profile.image_url ? faceImageUrl(req, profile.image_url) : null };
}

async function create(req, res) {
  const body = humps.decamelizeKeys(req.body || {});
  const profile = await faceProfilesService.createFaceProfile(req.user.sub, body, req.file);
  res.status(201).json(serialize(withAbsoluteImageUrl(req, profile)));
}

async function index(req, res) {
  const profiles = await faceProfilesService.listFaceProfiles(req.user.sub, req.query);
  res.json(serialize(profiles.map((profile) => withAbsoluteImageUrl(req, profile))));
}

async function destroy(req, res) {
  await faceProfilesService.deleteFaceProfile(req.user.sub, req.params.id);
  res.status(204).send();
}

module.exports = { create, index, destroy };
