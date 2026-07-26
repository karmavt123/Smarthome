const crypto = require('crypto');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice, requireSensor } = require('./ownership.service');
const { evaluateReading } = require('./alert-evaluation.service');

const MAX_HISTORY_LIMIT = 500;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

function parseTimestamp(timestamp) {
  if (!timestamp) return new Date();

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, 'Invalid reading timestamp');

  const now = Date.now();
  if (parsed.getTime() > now + 5 * 60 * 1000) {
    throw new HttpError(400, 'Reading timestamp is too far in the future');
  }
  if (parsed.getTime() < now - 30 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'Reading timestamp is older than 30 days');
  }

  return parsed;
}

function parseMessageId(messageId) {
  const value = messageId || `api:${crypto.randomUUID()}`;
  if (typeof value !== 'string' || !MESSAGE_ID_PATTERN.test(value)) {
    throw new HttpError(
      400,
      'messageId must be 1-100 letters, digits, dots, colons, underscores, or hyphens'
    );
  }
  return value;
}

function parseHistoryDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `Invalid ${fieldName} date`);
  return parsed;
}

function validateReading(sensor, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new HttpError(400, `${sensor.sensor_type} must be a finite number`);
  }

  const min = sensor.min_value == null ? null : Number(sensor.min_value);
  const max = sensor.max_value == null ? null : Number(sensor.max_value);
  if (min != null && value < min) {
    throw new HttpError(400, `${sensor.sensor_type} must be at least ${min}${sensor.unit}`);
  }
  if (max != null && value > max) {
    throw new HttpError(400, `${sensor.sensor_type} must be at most ${max}${sensor.unit}`);
  }

  return Number(value.toFixed(2));
}

async function storeReadings(device, entries, timestamp = new Date(), requestedMessageId) {
  const recordedAt = parseTimestamp(timestamp);
  const messageId = parseMessageId(requestedMessageId);
  const validated = entries.map(({ sensor, rawValue }) => ({
    sensor,
    value: validateReading(sensor, rawValue),
  }));

  const existing = await prisma.telemetry_messages.findUnique({
    where: {
      device_id_message_id: { device_id: device.id, message_id: messageId },
    },
  });
  if (existing) {
    return { deviceId: device.id, messageId, recordedAt, duplicate: true, stored: [] };
  }

  let readings;
  try {
    readings = await prisma.$transaction(async (tx) => {
      const envelope = await tx.telemetry_messages.create({
        data: {
          device_id: device.id,
          message_id: messageId,
          captured_at: recordedAt,
        },
      });
      const created = [];
      for (const item of validated) {
        created.push(await tx.sensor_readings.create({
          data: {
            sensor_id: item.sensor.id,
            telemetry_message_id: envelope.id,
            value: item.value,
            captured_at: recordedAt,
          },
        }));
      }
      await tx.devices.update({
        where: { id: device.id },
        data: { last_seen_at: new Date(), connection_status: 'online' },
      });
      return created;
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return { deviceId: device.id, messageId, recordedAt, duplicate: true, stored: [] };
    }
    throw error;
  }

  const stored = [];
  for (let index = 0; index < validated.length; index += 1) {
    stored.push({
      reading: readings[index],
      alertTransitions: await evaluateReading(validated[index].sensor, validated[index].value),
    });
  }

  return { deviceId: device.id, messageId, recordedAt, duplicate: false, stored };
}

async function storeReading(sensor, rawValue, timestamp = new Date(), messageId) {
  const device = await prisma.devices.findUnique({ where: { id: sensor.device_id } });
  if (!device) throw new HttpError(404, 'Sensor device not found');
  const result = await storeReadings(
    device,
    [{ sensor, rawValue }],
    timestamp,
    messageId
  );
  return result.stored[0] || null;
}

async function ingestBatch(userId, payload) {
  const { device_id, device_code, readings, timestamp, message_id } = payload;
  if (!device_id && !device_code) {
    throw new HttpError(400, 'deviceId or deviceCode is required');
  }
  if (!readings || typeof readings !== 'object' || Array.isArray(readings)) {
    throw new HttpError(400, 'readings must be an object keyed by sensor type');
  }

  let device = null;
  if (device_id) {
    device = await requireDevice(userId, device_id, { sensors: true });
  }

  if (!device && device_code != null) {
    const normalizedCode = String(device_code).trim();
    const numericCandidate = /^\d+$/.test(normalizedCode) ? Number(normalizedCode) : null;

    device = await prisma.devices.findFirst({
      where: {
        OR: [
          { device_code: normalizedCode },
          ...(numericCandidate != null ? [{ id: numericCandidate }] : []),
        ],
        homes: { user_id: Number(userId) },
      },
      include: { sensors: true },
    });
  }

  if (!device) throw new HttpError(404, 'Device not found');
  if (device.device_type !== 'sensor') {
    throw new HttpError(400, 'Only sensor devices can submit readings');
  }

  const entries = Object.entries(readings);
  if (entries.length === 0) throw new HttpError(400, 'At least one reading is required');

  const sensorEntries = [];
  for (const [sensorType, rawValue] of entries) {
    const sensor = device.sensors.find((item) => item.sensor_type === sensorType);
    if (!sensor) {
      throw new HttpError(400, `Device does not have a ${sensorType} sensor`);
    }
    sensorEntries.push({ sensor, rawValue });
  }
  return storeReadings(device, sensorEntries, timestamp || new Date(), message_id);
}

async function getHistory(userId, sensorId, query = {}) {
  const sensor = await requireSensor(userId, sensorId, { devices: true });
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), MAX_HISTORY_LIMIT);
  const capturedAt = {};

  if (query.from) capturedAt.gte = parseHistoryDate(query.from, 'from');
  if (query.to) capturedAt.lte = parseHistoryDate(query.to, 'to');
  if (capturedAt.gte && capturedAt.lte && capturedAt.gte > capturedAt.lte) {
    throw new HttpError(400, 'from must be earlier than to');
  }

  const readings = await prisma.sensor_readings.findMany({
    where: {
      sensor_id: sensor.id,
      ...(Object.keys(capturedAt).length ? { captured_at: capturedAt } : {}),
    },
    include: { telemetry_messages: { select: { message_id: true } } },
    orderBy: { captured_at: 'desc' },
    take: limit,
  });

  return { sensor, readings };
}

async function recordHeartbeat(userId, deviceId) {
  const device = await requireDevice(userId, deviceId);
  return prisma.devices.update({
    where: { id: device.id },
    data: { last_seen_at: new Date(), connection_status: 'online' },
  });
}

async function markStaleDevicesOffline(referenceTime = new Date()) {
  const timeoutSeconds = Math.max(Number(process.env.DEVICE_OFFLINE_AFTER_SECONDS) || 15, 1);
  const cutoff = new Date(referenceTime.getTime() - timeoutSeconds * 1000);

  return prisma.devices.updateMany({
    where: {
      connection_status: 'online',
      OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }],
    },
    data: { connection_status: 'offline' },
  });
}

module.exports = {
  MAX_HISTORY_LIMIT,
  parseTimestamp,
  parseMessageId,
  parseHistoryDate,
  validateReading,
  storeReading,
  storeReadings,
  ingestBatch,
  getHistory,
  recordHeartbeat,
  markStaleDevicesOffline,
};
