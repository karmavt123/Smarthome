const crypto = require('crypto');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');
const sseService = require('./sse.service');

const TOKEN_TTL_MS = Number(process.env.PAIRING_TOKEN_TTL_MINUTES || 10) * 60 * 1000;
const DEVICE_TYPES = ['light', 'fan', 'door', 'sensor'];

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createPairingToken(userId, homeId) {
  if (!homeId) throw new HttpError(400, 'homeId is required');
  await requireHome(userId, homeId);

  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.pairing_tokens.create({
    data: {
      home_id: Number(homeId),
      user_id: Number(userId),
      token_hash: hashToken(token),
      expires_at: expiresAt,
    },
  });

  return { token, expiresAt };
}

function validateDevicesInput(devicesInput) {
  if (!Array.isArray(devicesInput) || devicesInput.length === 0) {
    throw new HttpError(400, 'devices must be a non-empty array');
  }

  return devicesInput.map(({ device_type, device_code, name }) => {
    if (!DEVICE_TYPES.includes(device_type)) {
      throw new HttpError(400, `Invalid deviceType: ${device_type}`);
    }
    if (!device_code || !name) {
      throw new HttpError(400, 'deviceCode and name are required for each device');
    }
    return { device_type, device_code: String(device_code).trim(), name: String(name).trim() };
  });
}

async function pairDevices(pairingToken, devicesInput) {
  if (!pairingToken) throw new HttpError(400, 'pairingToken is required');
  const items = validateDevicesInput(devicesInput);

  const pairing = await prisma.pairing_tokens.findUnique({
    where: { token_hash: hashToken(pairingToken) },
  });
  if (!pairing) throw new HttpError(404, 'Invalid pairing token');
  if (pairing.used_at) throw new HttpError(410, 'Pairing token already used');
  if (pairing.expires_at < new Date()) throw new HttpError(410, 'Pairing token expired');

  const firstRoom = await prisma.rooms.findFirst({
    where: { home_id: pairing.home_id },
    orderBy: { id: 'asc' },
  });

  const devices = await prisma.$transaction(async (tx) => {
    // Guard against a token being redeemed twice concurrently.
    const claimed = await tx.pairing_tokens.updateMany({
      where: { id: pairing.id, used_at: null },
      data: { used_at: new Date() },
    });
    if (claimed.count === 0) throw new HttpError(410, 'Pairing token already used');

    const created = [];
    for (const item of items) {
      created.push(
        await tx.devices.create({
          data: {
            home_id: pairing.home_id,
            room_id: firstRoom ? firstRoom.id : null,
            name: item.name,
            device_code: item.device_code,
            device_type: item.device_type,
          },
        })
      );
    }
    return created;
  });

  sseService.publish(pairing.user_id, 'devices_paired', devices);
  return devices;
}

module.exports = { createPairingToken, pairDevices, hashToken };
