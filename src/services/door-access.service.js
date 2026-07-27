const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice } = require('./ownership.service');
const faceRecognitionService = require('./face-recognition.service');
const deviceCommandService = require('./device-command.service');
const alertEvaluationService = require('./alert-evaluation.service');

const ACCESS_METHODS = ['password', 'face', 'app', 'voice', 'manual'];
const ACCESS_RESULTS = ['success', 'failed'];

const FACE_LOCKOUT_THRESHOLD = 3;
const FACE_LOCKOUT_WINDOW_MS = 2 * 60 * 1000;
const FACE_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const PIN_PATTERN = /^\d{4,8}$/;

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

async function faceLockStatus(doorDeviceId) {
  const lastSuccess = await prisma.door_access_logs.findFirst({
    where: { door_device_id: doorDeviceId, access_method: 'face', result: 'success' },
    orderBy: { created_at: 'desc' },
  });

  const recentFailures = await prisma.door_access_logs.findMany({
    where: {
      door_device_id: doorDeviceId,
      access_method: 'face',
      result: 'failed',
      ...(lastSuccess ? { created_at: { gt: lastSuccess.created_at } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: FACE_LOCKOUT_THRESHOLD,
  });

  if (recentFailures.length < FACE_LOCKOUT_THRESHOLD) {
    return { locked: false, lockedUntil: null };
  }

  const newest = recentFailures[0].created_at;
  const oldest = recentFailures[recentFailures.length - 1].created_at;
  if (newest.getTime() - oldest.getTime() > FACE_LOCKOUT_WINDOW_MS) {
    return { locked: false, lockedUntil: null };
  }

  const lockedUntil = new Date(newest.getTime() + FACE_LOCKOUT_DURATION_MS);
  if (lockedUntil <= new Date()) {
    return { locked: false, lockedUntil: null };
  }

  return { locked: true, lockedUntil };
}

async function getFaceLockStatusForDoor(userId, doorDeviceId) {
  if (!doorDeviceId) throw new HttpError(400, 'doorDeviceId is required');
  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  const status = await faceLockStatus(device.id);
  return { doorDeviceId: device.id, ...status };
}

async function verifyFace(userId, doorDeviceId, imageFile) {
  if (!doorDeviceId) throw new HttpError(400, 'doorDeviceId is required');
  if (!imageFile) throw new HttpError(400, 'image file is required');

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  const lockStatus = await faceLockStatus(device.id);
  if (lockStatus.locked) {
    throw new HttpError(
      423,
      `Face ID đang bị khoá do sai quá ${FACE_LOCKOUT_THRESHOLD} lần liên tiếp, dùng mã PIN để mở cửa`,
      { lockedUntil: lockStatus.lockedUntil }
    );
  }

  const candidateEmbedding = await faceRecognitionService.computeFaceDescriptor(imageFile.buffer);

  const activeProfiles = await prisma.face_profiles.findMany({
    where: { home_id: device.home_id, is_active: true, face_embedding: { not: null } },
  });

  const threshold = faceRecognitionService.matchThreshold();
  const bestMatch = activeProfiles.length
    ? faceRecognitionService.findBestMatch(candidateEmbedding, activeProfiles)
    : null;
  const isSuccess = !!bestMatch && bestMatch.distance <= threshold;

  const accessLog = await prisma.door_access_logs.create({
    data: {
      door_device_id: device.id,
      user_id: isSuccess ? bestMatch.profile.user_id || Number(userId) : null,
      face_profile_id: isSuccess ? bestMatch.profile.id : null,
      access_method: 'face',
      result: isSuccess ? 'success' : 'failed',
      confidence_score: bestMatch ? bestMatch.distance : null,
      failure_reason: isSuccess ? null : 'No matching face profile within threshold',
    },
  });

  if (!isSuccess) {
    await alertEvaluationService.evaluateDoorAccessFailures(device, 'face');
    return { result: 'failed', confidenceScore: null, doorAccessLogId: accessLog.id };
  }

  const { action: command } = await deviceCommandService.createDeviceCommand(
    bestMatch.profile.user_id || Number(userId),
    device.id,
    'open',
    'face'
  );

  return {
    result: 'success',
    confidenceScore: bestMatch.distance,
    faceProfileId: bestMatch.profile.id,
    doorAccessLogId: accessLog.id,
    deviceCommandId: command.id,
  };
}

function presentDoorPassword(doorPassword) {
  if (!doorPassword) return doorPassword;
  const { password_hash, ...rest } = doorPassword;
  return rest;
}

async function getPinStatusForDoor(userId, doorDeviceId) {
  if (!doorDeviceId) throw new HttpError(400, 'doorDeviceId is required');
  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  const activePassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
  });

  return { doorDeviceId: device.id, hasPin: !!activePassword };
}

async function setDoorPin(userId, doorDeviceId, pin) {
  if (!doorDeviceId) throw new HttpError(400, 'doorDeviceId is required');
  if (!PIN_PATTERN.test(String(pin || ''))) {
    throw new HttpError(400, 'pin must be 4 to 8 digits');
  }

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  const passwordHash = await bcrypt.hash(String(pin), 10);

  const doorPassword = await prisma.$transaction(async (tx) => {
    await tx.door_passwords.updateMany({
      where: { door_device_id: device.id, is_active: true },
      data: { is_active: false },
    });

    return tx.door_passwords.create({
      data: {
        door_device_id: device.id,
        password_hash: passwordHash,
        is_active: true,
        updated_by: Number(userId),
      },
    });
  });

  return presentDoorPassword(doorPassword);
}

async function verifyPin(userId, doorDeviceId, pin) {
  if (!doorDeviceId) throw new HttpError(400, 'doorDeviceId is required');
  if (!pin) throw new HttpError(400, 'pin is required');

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== 'door') throw new HttpError(400, 'Device is not a door');

  const activePassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
  });
  if (!activePassword) throw new HttpError(400, 'No PIN configured for this door');

  const matches = await bcrypt.compare(String(pin), activePassword.password_hash);

  const accessLog = await prisma.door_access_logs.create({
    data: {
      door_device_id: device.id,
      user_id: matches ? Number(userId) : null,
      access_method: 'password',
      result: matches ? 'success' : 'failed',
      failure_reason: matches ? null : 'Incorrect PIN',
    },
  });

  if (!matches) {
    return { result: 'failed', doorAccessLogId: accessLog.id };
  }

  const { action: command } = await deviceCommandService.createDeviceCommand(
    Number(userId),
    device.id,
    'open',
    'password'
  );

  return { result: 'success', doorAccessLogId: accessLog.id, deviceCommandId: command.id };
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
  verifyFace,
  getFaceLockStatusForDoor,
  getPinStatusForDoor,
  setDoorPin,
  verifyPin,
  listDoorAccessEvents,
};
