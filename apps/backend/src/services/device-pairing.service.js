const crypto = require('crypto');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome } = require('./ownership.service');
const sseService = require('./sse.service');

const TOKEN_TTL_MS = Number(process.env.PAIRING_TOKEN_TTL_MINUTES || 10) * 60 * 1000;
const DEVICE_TYPES = ['light', 'fan', 'door', 'sensor'];

// Default unit/range per sensor_type — applied when pairing a device_type: 'sensor'
// so `sensors` rows exist right away and MQTT readings (mqtt.service.js's
// handleSensorReading) have something to match against instead of silently
// dropping data because no `sensors` row exists yet for that device+type.
const SENSOR_TYPE_DEFAULTS = {
  temperature: { unit: '°C', min_value: 0, max_value: 50 },
  humidity: { unit: '%', min_value: 0, max_value: 100 },
  light: { unit: '%', min_value: 0, max_value: 100 },
};
const SENSOR_TYPES = Object.keys(SENSOR_TYPE_DEFAULTS);

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

  return devicesInput.map(({ device_type, device_code, name, sensor_types }) => {
    if (!DEVICE_TYPES.includes(device_type)) {
      throw new HttpError(400, `Invalid deviceType: ${device_type}`);
    }
    if (!device_code || !name) {
      throw new HttpError(400, 'deviceCode and name are required for each device');
    }

    let sensorTypes = [];
    if (device_type === 'sensor') {
      if (!Array.isArray(sensor_types) || sensor_types.length === 0) {
        throw new HttpError(
          400,
          'sensorTypes is required for deviceType "sensor" (one or more of: temperature, humidity, light)'
        );
      }
      sensorTypes = [...new Set(sensor_types)];
      const invalid = sensorTypes.filter((type) => !SENSOR_TYPES.includes(type));
      if (invalid.length > 0) {
        throw new HttpError(400, `Invalid sensorTypes: ${invalid.join(', ')}`);
      }
    }

    return {
      device_type,
      device_code: String(device_code).trim(),
      name: String(name).trim(),
      sensor_types: sensorTypes,
    };
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
      const device = await tx.devices.create({
        data: {
          home_id: pairing.home_id,
          room_id: firstRoom ? firstRoom.id : null,
          name: item.name,
          device_code: item.device_code,
          device_type: item.device_type,
        },
      });

      if (item.sensor_types.length > 0) {
        await tx.sensors.createMany({
          data: item.sensor_types.map((sensorType) => ({
            device_id: device.id,
            sensor_type: sensorType,
            ...SENSOR_TYPE_DEFAULTS[sensorType],
          })),
        });
      }

      created.push(device);
    }
    return created;
  });

  sseService.publish(pairing.user_id, 'devices_paired', devices);
  return devices;
}

module.exports = { createPairingToken, pairDevices, hashToken };
