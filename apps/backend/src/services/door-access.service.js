const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const { requireDevice } = require("./ownership.service");
const faceIdClientService = require("./face-id-client.service");
const deviceCommandService = require("./device-command.service");
const alertEvaluationService = require("./alert-evaluation.service");
const { saveFaceImage } = require("../utils/face-image-storage");

const ACCESS_METHODS = ["password", "face", "app", "voice", "manual"];
const ACCESS_RESULTS = ["success", "failed"];

// Lockout applies to BOTH face and PIN. Keeping one set of numbers means an attacker
// cannot dodge the face lockout by switching to the PIN keypad (the PIN is advertised as
// the fallback in the 423 message below, so it has to be at least as well defended).
const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_WINDOW_MS = 2 * 60 * 1000;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

const FACE_LOCKOUT_THRESHOLD = LOCKOUT_THRESHOLD;
const PIN_PATTERN = /^\d{4,8}$/;

async function createDoorAccessEvent(userId, payload) {
  if (
    Object.prototype.hasOwnProperty.call(payload, "pin") ||
    Object.prototype.hasOwnProperty.call(payload, "password")
  ) {
    throw new HttpError(
      400,
      "Do not send plaintext PINs to the access-event log",
    );
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

  if (!door_device_id) throw new HttpError(400, "doorDeviceId is required");

  if (!ACCESS_METHODS.includes(access_method)) {
    throw new HttpError(
      400,
      `accessMethod must be one of: ${ACCESS_METHODS.join(", ")}`,
    );
  }
  if (!ACCESS_RESULTS.includes(result)) {
    throw new HttpError(
      400,
      `result must be one of: ${ACCESS_RESULTS.join(", ")}`,
    );
  }

  // This endpoint only RECORDS an access that some other subsystem already performed. It
  // never authenticates anybody, so what a client may write through it is deliberately
  // narrow. Two separate holes were closed here:
  //
  //  - password/face are refused outright, in BOTH directions. A fake `success` reset the
  //    lockout counter (accessLockStatus counts failures *since the last success*), so an
  //    attacker holding a session could log one after every 3 wrong PINs and brute-force a
  //    4-digit PIN forever. Blocking only `success` — the previous fix — left the mirror
  //    image open: spamming three `failed` rows locked the real owner out of verify-pin
  //    AND set-pin for 5 minutes, renewable indefinitely. A denial of service on their own
  //    front door. Since verify-pin/verify-face write their own rows, nothing legitimate
  //    needs to post password/face here, and refusing both results closes both holes.
  //
  //  - app/voice may only record a failure. A `success` here wrote devices.status = "open"
  //    and pushed a device_status SSE without ever talking to the board, so the app showed
  //    an open door that was physically shut. For `voice` it was worse: executeVoiceCommand
  //    deliberately refuses to queue a door command and returns requiresVerification, and
  //    this endpoint handed back exactly the state that safeguard exists to withhold.
  //    Real app/voice unlocks go through device_commands, which does talk to the board.
  //
  // `manual` keeps both results: a door opened by hand is genuinely open, and no other
  // subsystem is ever going to report it.
  if (access_method === "password" || access_method === "face") {
    throw new HttpError(
      400,
      "password/face access is recorded by verify-pin and verify-face, not here",
    );
  }
  if (result === "success" && access_method !== "manual") {
    throw new HttpError(
      400,
      "Only a manual access can be recorded as successful here; app/voice unlocks go through device commands",
    );
  }

  const device = await requireDevice(userId, door_device_id);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  // No method this endpoint still accepts has any use for a face profile — `face` is
  // refused above. Left resolvable, it was a forgeable audit record: posting
  // {accessMethod:"manual", result:"success", faceProfileId:P} wrote a successful door
  // opening that the history then renders with that enrolled person's name and photo,
  // pinning an unlock on an innocent household member.
  if (face_profile_id != null) {
    throw new HttpError(
      400,
      "faceProfileId belongs to a face verification; record those with verify-face",
    );
  }
  const confidence = confidence_score == null ? null : Number(confidence_score);
  if (
    confidence != null &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    throw new HttpError(400, "confidenceScore must be between 0 and 1");
  }
  if (result === "failed" && !failure_reason) {
    throw new HttpError(400, "failureReason is required for failed access");
  }

  const { accessLog, deviceAction } = await prisma.$transaction(async (tx) => {
    const accessLog = await tx.door_access_logs.create({
      data: {
        door_device_id: device.id,
        user_id: Number(userId),
        face_profile_id: null,
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
        user_id: Number(userId),
        action: "open",
        control_method: access_method,
        execution_status: result,
        failure_reason: failure_reason || null,
      },
    });

    return { accessLog, deviceAction };
  });

  // NOTHING here writes devices.status. This endpoint records that an access happened; it
  // never talked to the board, so it has no idea whether the door actually moved, and the
  // MQTT layer already owns that column.
  //
  // It used to set status = "open" on any success, which is how `manual` stayed a hole
  // after `voice` and `app` were closed. The frontend gates the voice-unlock verification
  // step on device state, not on access method (VoiceSearchModal.js: `device.status !==
  // 'open'`), so one forged `{accessMethod:"manual", result:"success"}` marked the door
  // open and the PIN/Face confirmation step was skipped on the next "mở cửa" — the exact
  // safeguard executeVoiceCommand withholds behind requiresVerification. The door tile
  // also read OPEN, and offered "close", for a door that was physically shut.
  return { accessLog, deviceAction };
}

async function accessLockStatus(doorDeviceId, accessMethod) {
  const lastSuccess = await prisma.door_access_logs.findFirst({
    where: {
      door_device_id: doorDeviceId,
      access_method: accessMethod,
      result: "success",
    },
    orderBy: { id: "desc" },
  });

  // Failures logged against a PIN that has since been replaced must not lock out the new
  // one — they were guesses at a secret that no longer opens anything. setDoorPin used to
  // achieve this by writing a fake `password`/`success` row, which reset the counter but
  // left an entry in the door history indistinguishable from a real unlock (and wrote it
  // *outside* the transaction, so a failed PIN write still left the phantom unlock behind).
  //
  // The anchor is a log ID, not a timestamp, for the same reason the lastSuccess filter
  // below compares IDs: both columns are DATETIME(0) and MySQL ROUNDS when storing them,
  // so a guess at 10:00:00.600 and a PIN change at 10:00:01.400 both land on 10:00:01 and
  // a `created_at >=` anchor counted a guess made 0.8s BEFORE the change. The user was
  // locked out after two wrong tries instead of three. IDs are monotonic, so there is no
  // clock in this comparison at all.
  let anchorLogId = null;
  if (accessMethod === "password") {
    const activePassword = await prisma.door_passwords.findFirst({
      where: { door_device_id: doorDeviceId, is_active: true },
      orderBy: { id: "desc" },
    });
    anchorLogId = activePassword ? activePassword.anchor_log_id : null;
  }

  const recentFailures = await prisma.door_access_logs.findMany({
    where: {
      door_device_id: doorDeviceId,
      access_method: accessMethod,
      result: "failed",
      // Compare by id (monotonic), not created_at: the column is DATETIME(0) (second
      // precision), so a success followed by fast failed attempts within the same second
      // — routine with a mocked/fast ai-service — would tie on created_at and a `gt`
      // comparison there would silently drop those failures from the lockout count.
      // Both anchors are IDs, so the tighter one simply wins.
      ...(lastSuccess || anchorLogId != null
        ? {
            id: {
              gt:
                lastSuccess && anchorLogId != null
                  ? (lastSuccess.id > anchorLogId ? lastSuccess.id : anchorLogId)
                  : (lastSuccess ? lastSuccess.id : anchorLogId),
            },
          }
        : {}),
    },
    orderBy: { id: "desc" },
    take: LOCKOUT_THRESHOLD,
  });

  if (recentFailures.length < LOCKOUT_THRESHOLD) {
    return { locked: false, lockedUntil: null };
  }

  const newest = recentFailures[0].created_at;
  const oldest = recentFailures[recentFailures.length - 1].created_at;
  if (newest.getTime() - oldest.getTime() > LOCKOUT_WINDOW_MS) {
    return { locked: false, lockedUntil: null };
  }

  const lockedUntil = new Date(newest.getTime() + LOCKOUT_DURATION_MS);
  if (lockedUntil <= new Date()) {
    return { locked: false, lockedUntil: null };
  }

  return { locked: true, lockedUntil };
}

// Thin wrapper: the face lock is the one exposed over the API and used by verifyFace.
function faceLockStatus(doorDeviceId) {
  return accessLockStatus(doorDeviceId, "face");
}

async function getFaceLockStatusForDoor(userId, doorDeviceId) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");
  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const status = await faceLockStatus(device.id);
  return { doorDeviceId: device.id, ...status };
}

async function verifyFace(userId, doorDeviceId, imageFiles) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");
  if (!imageFiles || imageFiles.length === 0)
    throw new HttpError(400, "at least one image frame is required");

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const lockStatus = await faceLockStatus(device.id);
  if (lockStatus.locked) {
    throw new HttpError(
      423,
      `Face ID đang bị khoá do sai quá ${FACE_LOCKOUT_THRESHOLD} lần liên tiếp, dùng mã PIN để mở cửa`,
      { lockedUntil: lockStatus.lockedUntil },
    );
  }

  const activeProfiles = await prisma.face_profiles.findMany({
    where: {
      home_id: device.home_id,
      is_active: true,
      face_embedding: { not: null },
    },
  });
  const candidates = activeProfiles.map((profile) => ({
    id: profile.id,
    embedding: JSON.parse(profile.face_embedding),
  }));

  // Throws HttpError(422, ...) for no-face/multiple-faces, or HttpError(503, ...) if the
  // ai-service is unreachable/misconfigured — neither case writes a log or counts toward
  // the lockout (same as the old face-api.js code, which threw before any log was written).
  const frameBuffers = imageFiles.map((file) => file.buffer);
  const result = await faceIdClientService.verifyFace(frameBuffers, candidates);
  // console.log("result", result);

  if (!result.isLive) {
    // Spoofed/replayed capture — not a real match attempt against a candidate, so it doesn't
    // count toward the 3-strikes lockout either (see docs/backend/NODE-INTEGRATION-FOR-FACE-ID.md).
    return {
      result: "failed",
      reason: "liveness_failed",
      livenessScore: result.livenessScore,
    };
  }

  const matchedProfile = result.matched
    ? activeProfiles.find((profile) => profile.id === result.matched.id)
    : null;
  const isSuccess = !!matchedProfile;

  // Save the captured frame regardless of match outcome, so a failed attempt can still be
  // reviewed by photo in the history list (face_profile_id is only ever set on a match).
  const snapshotFilename = saveFaceImage(
    imageFiles[0].buffer,
    imageFiles[0].mimetype,
  );

  const accessLog = await prisma.door_access_logs.create({
    data: {
      door_device_id: device.id,
      user_id: Number(userId),
      face_profile_id: isSuccess ? matchedProfile.id : null,
      access_method: "face",
      result: isSuccess ? "success" : "failed",
      confidence_score: result.distance ?? null,
      snapshot_url: snapshotFilename,
      failure_reason: isSuccess
        ? null
        : "No matching face profile within threshold",
    },
  });

  if (!isSuccess) {
    await alertEvaluationService.evaluateDoorAccessFailures(device, "face");
    return {
      result: "failed",
      confidenceScore: null,
      doorAccessLogId: accessLog.id,
    };
  }

  const { action: command } = await deviceCommandService.createDeviceCommand(
    matchedProfile.user_id || Number(userId),
    device.id,
    "open",
    "face",
  );

  return {
    result: "success",
    confidenceScore: result.distance,
    faceProfileId: matchedProfile.id,
    doorAccessLogId: accessLog.id,
    deviceCommandId: command.id,
  };
}

function presentDoorPassword(doorPassword) {
  if (!doorPassword) return doorPassword;
  // anchor_log_id is lockout bookkeeping, not something a client has any use for; leaking
  // it would also tell an attacker exactly how many log rows precede their attempts.
  const { password_hash, anchor_log_id, ...rest } = doorPassword;
  return rest;
}

async function getPinStatusForDoor(userId, doorDeviceId) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");
  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const activePassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
    // Prisma's findFirst emits LIMIT 1 with no ORDER BY, so without this MySQL may return
    // ANY active row. Nothing makes is_active unique per door, and if a second one ever
    // appeared the PIN that opens the door and the PIN that anchors the lockout could be
    // different rows — which would silently switch the lockout off.
    orderBy: { id: "desc" },
  });

  // Reported alongside hasPin so the UI can show the PIN lockout the same way it shows
  // the Face ID one, instead of the user only discovering it via a 423 mid-attempt.
  const lockStatus = await accessLockStatus(device.id, "password");

  return {
    doorDeviceId: device.id,
    hasPin: !!activePassword,
    locked: lockStatus.locked,
    lockedUntil: lockStatus.lockedUntil,
    lockoutThreshold: LOCKOUT_THRESHOLD,
  };
}

// Proving the current PIN. Shared by setDoorPin and clearDoorPin so the two can never
// drift: whichever way a PIN leaves the door, it costs the same proof. Without it the
// lockout in verifyPin is decorative — anyone holding a session (a borrowed or stolen
// phone, the exact case lockout exists for) could just overwrite the PIN and walk in.
async function requireCurrentPin(userId, device, existingPassword, currentPin, action) {
  const lockStatus = await accessLockStatus(device.id, "password");
  if (lockStatus.locked) {
    throw new HttpError(
      423,
      `Mã PIN đang bị khoá do sai quá ${LOCKOUT_THRESHOLD} lần liên tiếp, thử lại sau`,
      { lockedUntil: lockStatus.lockedUntil },
    );
  }

  if (!currentPin) {
    throw new HttpError(400, "currentPin is required to change an existing PIN");
  }

  const currentMatches = await bcrypt.compare(
    String(currentPin),
    existingPassword.password_hash,
  );
  if (currentMatches) return;

  // Logged as a normal failed attempt so guessing the old PIN through this endpoint trips
  // the same lockout as guessing it through verify-pin.
  await prisma.door_access_logs.create({
    data: {
      door_device_id: device.id,
      user_id: Number(userId),
      access_method: "password",
      result: "failed",
      failure_reason: `Incorrect current PIN on ${action}`,
    },
  });
  await alertEvaluationService.evaluateDoorAccessFailures(device, "password");
  throw new HttpError(401, "Mã PIN hiện tại không đúng");
}

// Removing the PIN entirely. This exists because deleteDevice refuses to delete a door
// that still has one — otherwise deleting the door WAS the way to drop a PIN you could not
// produce, since every FK cascades. Both exits now cost the same proof.
async function clearDoorPin(userId, doorDeviceId, currentPin) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const existingPassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
    orderBy: { id: "desc" },
  });
  if (!existingPassword) {
    throw new HttpError(400, "No PIN configured for this door");
  }

  await requireCurrentPin(userId, device, existingPassword, currentPin, "removal");

  await prisma.door_passwords.updateMany({
    where: { door_device_id: device.id, is_active: true },
    data: { is_active: false },
  });

  return { cleared: true };
}

async function setDoorPin(userId, doorDeviceId, pin, currentPin) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");
  if (!PIN_PATTERN.test(String(pin || ""))) {
    throw new HttpError(400, "pin must be 4 to 8 digits");
  }

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const existingPassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
    // Prisma's findFirst emits LIMIT 1 with no ORDER BY, so without this MySQL may return
    // ANY active row. Nothing makes is_active unique per door, and if a second one ever
    // appeared the PIN that opens the door and the PIN that anchors the lockout could be
    // different rows — which would silently switch the lockout off.
    orderBy: { id: "desc" },
  });

  // Changing an existing PIN has to prove knowledge of the old one. Setting the FIRST PIN
  // does not — there is no secret to protect yet.
  if (existingPassword) {
    await requireCurrentPin(userId, device, existingPassword, currentPin, "change");
  }

  // No door_access_logs row is written for a successful PIN change. The earlier failures
  // stop counting because the new row below stamps `anchor_log_id`, and accessLockStatus
  // only counts failures with a larger id. Writing a `success` row here instead — the
  // previous approach — put an entry in the security history that read exactly like
  // someone opening the door with the PIN, which is precisely the event a stolen-phone
  // attacker would want to hide behind.
  const passwordHash = await bcrypt.hash(String(pin), 10);

  const doorPassword = await prisma.$transaction(async (tx) => {
    await tx.door_passwords.updateMany({
      where: { door_device_id: device.id, is_active: true },
      data: { is_active: false },
    });

    // Every failure logged up to this instant was a guess at the PIN being replaced, so
    // the new PIN starts its lockout count from here. Read inside the transaction so a
    // concurrent verify-pin cannot slip a row in between the read and the insert.
    const newestLog = await tx.door_access_logs.findFirst({
      where: { door_device_id: device.id },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    return tx.door_passwords.create({
      data: {
        door_device_id: device.id,
        password_hash: passwordHash,
        is_active: true,
        anchor_log_id: newestLog ? newestLog.id : null,
        updated_by: Number(userId),
      },
    });
  });

  return presentDoorPassword(doorPassword);
}

async function verifyPin(userId, doorDeviceId, pin) {
  if (!doorDeviceId) throw new HttpError(400, "doorDeviceId is required");
  if (!pin) throw new HttpError(400, "pin is required");

  const device = await requireDevice(userId, doorDeviceId);
  if (device.device_type !== "door")
    throw new HttpError(400, "Device is not a door");

  const lockStatus = await accessLockStatus(device.id, "password");
  if (lockStatus.locked) {
    throw new HttpError(
      423,
      `Mã PIN đang bị khoá do sai quá ${LOCKOUT_THRESHOLD} lần liên tiếp, thử lại sau`,
      { lockedUntil: lockStatus.lockedUntil },
    );
  }

  const activePassword = await prisma.door_passwords.findFirst({
    where: { door_device_id: device.id, is_active: true },
    // Prisma's findFirst emits LIMIT 1 with no ORDER BY, so without this MySQL may return
    // ANY active row. Nothing makes is_active unique per door, and if a second one ever
    // appeared the PIN that opens the door and the PIN that anchors the lockout could be
    // different rows — which would silently switch the lockout off.
    orderBy: { id: "desc" },
  });
  if (!activePassword)
    throw new HttpError(400, "No PIN configured for this door");

  const matches = await bcrypt.compare(
    String(pin),
    activePassword.password_hash,
  );

  const accessLog = await prisma.door_access_logs.create({
    data: {
      door_device_id: device.id,
      user_id: Number(userId),
      access_method: "password",
      result: matches ? "success" : "failed",
      failure_reason: matches ? null : "Incorrect PIN",
    },
  });

  if (!matches) {
    await alertEvaluationService.evaluateDoorAccessFailures(device, "password");
    return { result: "failed", doorAccessLogId: accessLog.id };
  }

  const { action: command } = await deviceCommandService.createDeviceCommand(
    Number(userId),
    device.id,
    "open",
    "password",
  );

  return {
    result: "success",
    doorAccessLogId: accessLog.id,
    deviceCommandId: command.id,
  };
}

async function getAccessHistory(userId, query = {}, accessMethod) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const page = Math.max(Number(query.page) || 1, 1);

  let doorDeviceId;
  if (query.door_device_id) {
    const device = await requireDevice(userId, query.door_device_id);
    if (device.device_type !== "door")
      throw new HttpError(400, "Device is not a door");
    doorDeviceId = device.id;
  }

  const where = {
    devices: { homes: { user_id: Number(userId) } },
    access_method: accessMethod,
    ...(doorDeviceId ? { door_device_id: doorDeviceId } : {}),
    ...(query.result ? { result: query.result } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.door_access_logs.findMany({
      where,
      include: {
        devices: true,
        face_profiles: {
          select: {
            id: true,
            name: true,
            image_url: true,
            is_active: true,
          },
        },
        users: true,
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.door_access_logs.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getFaceAccessHistory(userId, query = {}) {
  return getAccessHistory(userId, query, "face");
}

async function getPinAccessHistory(userId, query = {}) {
  return getAccessHistory(userId, query, "password");
}

async function listDoorAccessEvents(userId, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  return prisma.door_access_logs.findMany({
    where: {
      devices: { homes: { user_id: Number(userId) } },
      ...(query.door_device_id
        ? { door_device_id: Number(query.door_device_id) }
        : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.access_method ? { access_method: query.access_method } : {}),
    },
    include: {
      devices: true,
      face_profiles: {
        select: {
          id: true,
          name: true,
          image_url: true,
          is_active: true,
        },
      },
      users: true,
    },
    orderBy: { created_at: "desc" },
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
  clearDoorPin,
  verifyPin,
  listDoorAccessEvents,
  getFaceAccessHistory,
  getPinAccessHistory,
};
