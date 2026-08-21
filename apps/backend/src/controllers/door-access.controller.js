const humps = require("humps");
const doorAccessService = require("../services/door-access.service");
const serialize = require("../utils/serialize");
const { faceImageUrl } = require("../utils/face-image-storage");

// verify-face writes snapshot_url as a bare uploads/faces/ filename (see
// door-access.service.js's verifyFace); createDoorAccessEvent's caller-supplied
// snapshot_url is already a full URL, so only rows coming out of verifyFace need this.
function withAbsoluteSnapshotUrl(req, log) {
  return {
    ...log,
    snapshot_url: log.snapshot_url ? faceImageUrl(req, log.snapshot_url) : null,
  };
}

async function create(req, res) {
  const result = await doorAccessService.createDoorAccessEvent(
    req.user.sub,
    req.body,
  );
  res.status(201).json(serialize(result));
}

async function index(req, res) {
  const result = await doorAccessService.listDoorAccessEvents(
    req.user.sub,
    req.query,
  );
  res.json(serialize(result.map((log) => withAbsoluteSnapshotUrl(req, log))));
}

async function verifyFace(req, res) {
  const body = humps.decamelizeKeys(req.body || {});
  const result = await doorAccessService.verifyFace(
    req.user.sub,
    body.door_device_id,
    req.files,
  );
  res.status(200).json(serialize(result));
}

async function faceLockStatus(req, res) {
  const result = await doorAccessService.getFaceLockStatusForDoor(
    req.user.sub,
    req.query.door_device_id,
  );
  res.json(serialize(result));
}

async function pinStatus(req, res) {
  const result = await doorAccessService.getPinStatusForDoor(
    req.user.sub,
    req.query.door_device_id,
  );
  res.json(serialize(result));
}

async function setPin(req, res) {
  const result = await doorAccessService.setDoorPin(
    req.user.sub,
    req.params.doorDeviceId,
    req.body.pin,
  );
  res.status(200).json(serialize(result));
}

async function faceHistory(req, res) {
  const result = await doorAccessService.getFaceAccessHistory(
    req.user.sub,
    req.query,
  );
  res.json(
    serialize({
      ...result,
      data: result.data.map((log) => withAbsoluteSnapshotUrl(req, log)),
    }),
  );
}

async function verifyPin(req, res) {
  const result = await doorAccessService.verifyPin(
    req.user.sub,
    req.body.door_device_id,
    req.body.pin,
  );
  res.status(200).json(serialize(result));
}

async function pinHistory(req, res) {
  const result = await doorAccessService.getPinAccessHistory(
    req.user.sub,
    req.query,
  );
  res.json(serialize(result));
}

module.exports = {
  create,
  index,
  verifyFace,
  faceLockStatus,
  pinStatus,
  setPin,
  verifyPin,
  faceHistory,
  pinHistory,
};
