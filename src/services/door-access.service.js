const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice } = require('./ownership.service');

const ACCESS_METHODS = ['password', 'face', 'app', 'voice', 'manual'];
const ACCESS_RESULTS = ['success', 'failed'];

async function createDoorAccessEvent(userId, payload) {
  if (
    Object.prototype.hasOwnProperty.call(payload, 'pin')
    || Object.prototype.hasOwnProperty.call(payload, 'password')
  ) {
    throw new HttpError(400, 'Do not send plaintext PINs to the access-event log');
  }

  const {
    door_device_id,
    face_profile_id,
    access_method,
    result,
    confidence_score,
    snapshot_url,
    failure_reason,
  } = payload;

  if (!door_device_id) throw new HttpError(400, 'doorDeviceId is required');
  if (!ACCESS_METHODS.includes(access_method)) {
    throw new HttpError(400, `accessMethod must be one of: ${ACCESS_METHODS.join(', ')}`);
  }
  if (!ACCESS_RESULTS.includes(result)) {
    throw new HttpError(400, `result must be one of: ${ACCESS_RESULTS.join(', ')}`);
  }

  const device = await requireDevice(userId, door_device_id);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  let faceProfile = null;
  if (face_profile_id != null) {
    faceProfile = await prisma.face_profiles.findFirst({
      where: { id: Number(face_profile_id), home_id: device.home_id },
    });
    if (!faceProfile) throw new HttpError(404, 'Face profile not found');
  }
  if (access_method === 'face' && !faceProfile) {
    throw new HttpError(400, 'faceProfileId is required for face access');
  }

  const confidence = confidence_score == null ? null : Number(confidence_score);
  if (confidence != null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new HttpError(400, 'confidenceScore must be between 0 and 1');
  }
  if (result === 'failed' && !failure_reason) {
    throw new HttpError(400, 'failureReason is required for failed access');
  }

  return prisma.$transaction(async (tx) => {
    const accessLog = await tx.door_access_logs.create({
      data: {
        door_device_id: device.id,
        user_id: result === 'success' ? faceProfile?.user_id || Number(userId) : null,
        face_profile_id: faceProfile?.id || null,
        access_method,
        result,
        confidence_score: confidence,
        snapshot_url: snapshot_url || null,
        failure_reason: failure_reason || null,
      },
    });

    const deviceAction = await tx.device_actions.create({
      data: {
        device_id: device.id,
        user_id: result === 'success' ? faceProfile?.user_id || Number(userId) : null,
        action: 'open',
        control_method: access_method,
        execution_status: result,
        failure_reason: failure_reason || null,
      },
    });

    if (result === 'success') {
      await tx.devices.update({
        where: { id: device.id },
        data: {
          status: 'open',
          last_seen_at: new Date(),
          connection_status: 'online',
        },
      });
    }

    return { accessLog, deviceAction };
  });
}

async function listDoorAccessEvents(userId, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  return prisma.door_access_logs.findMany({
    where: {
      devices: { homes: { user_id: Number(userId) } },
      ...(query.door_device_id ? { door_device_id: Number(query.door_device_id) } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.access_method ? { access_method: query.access_method } : {}),
    },
    include: { devices: true, face_profiles: true, users: true },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

module.exports = {
  ACCESS_METHODS,
  ACCESS_RESULTS,
  createDoorAccessEvent,
  listDoorAccessEvents,
};
