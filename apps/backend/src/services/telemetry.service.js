const crypto = require('crypto');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireDevice, requireSensor } = require('./ownership.service');
const { evaluateReading } = require('./alert-evaluation.service');
const sseService = require('./sse.service');
const { buildDateRange, reportOffset } = require('../utils/date-range');

const MAX_HISTORY_LIMIT = 500;
const DEFAULT_TREND_DAYS = 7;
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

  const home = await prisma.homes.findUnique({
    where: { id: device.home_id },
    select: { user_id: true },
  });
  if (home) {
    for (let index = 0; index < validated.length; index += 1) {
      sseService.publish(home.user_id, 'sensor_reading', {
        device_id: device.id,
        sensor_id: validated[index].sensor.id,
        sensor_type: validated[index].sensor.sensor_type,
        value: validated[index].value,
        captured_at: stored[index].reading.captured_at,
      });
    }
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
  const capturedAt = buildDateRange(query);

  const readings = await prisma.sensor_readings.findMany({
    where: {
      sensor_id: sensor.id,
      ...(capturedAt ? { captured_at: capturedAt } : {}),
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
  // Mac dinh 60 de khop .env.example va docker-compose. Truoc day o day la 15 trong khi
  // config ship kem la 60 — chay backend ma thieu bien moi truong thi thiet bi bi danh
  // dau offline sau 15 giay, nhanh gap 4 lan y muon, gay nhay online/offline lien tuc.
  const timeoutSeconds = Math.max(Number(process.env.DEVICE_OFFLINE_AFTER_SECONDS) || 60, 1);
  const cutoff = new Date(referenceTime.getTime() - timeoutSeconds * 1000);

  return prisma.devices.updateMany({
    where: {
      connection_status: 'online',
      OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }],
    },
    data: { connection_status: 'offline' },
  });
}

// Daily aggregation done in MySQL instead of shipping raw rows to the browser.
// With a reading every few seconds, a 7-day window is >100k rows — far past the 500-row
// cap on getSensorReadings, which is why the "trung bình theo ngày, 7 ngày" chart used
// to really plot only the last couple of hours. GROUP BY here returns 7 rows.
async function getDailySensorAverages(userId, sensorId, query = {}) {
  const sensor = await requireSensor(userId, sensorId);

  const range = buildDateRange(query) || {};
  const from = range.gte || new Date(Date.now() - DEFAULT_TREND_DAYS * 24 * 60 * 60 * 1000);
  const to = range.lte || new Date();

  // Tagged template -> Prisma parameterises these, they are not string-concatenated.
  //
  // DATE_FORMAT, not DATE(): DATE() comes back as a JS Date built at local midnight, and
  // formatting that through toISOString() would shift the calendar day.
  //
  // CONVERT_TZ so the buckets are the reader's days, not UTC days — grouping raw
  // captured_at put everything from 00:00-07:00 local into the previous day's column.
  // An offset literal is used rather than a zone name because named zones need the
  // mysql.time_zone_* tables loaded, which the stock mysql:8.0 image does not do.
  const offset = reportOffset();

  // GROUP BY on the ALIAS, not on a second copy of the expression. Repeating it meant the
  // offset placeholder appeared twice, and MySQL cannot prove two separate `?` parameters
  // hold the same value — under ONLY_FULL_GROUP_BY (on by default in the mysql:8.0 image)
  // it therefore read the SELECT list as containing a bare non-aggregated column and
  // failed every call with ER_WRONG_FIELD_WITH_GROUP (1055). Grouping by the alias keeps
  // one placeholder and one expression.
  const rows = await prisma.$queryRaw`
    SELECT DATE_FORMAT(CONVERT_TZ(captured_at, '+00:00', ${offset}), '%Y-%m-%d') AS day,
           AVG(value)                                                            AS avg_value,
           MIN(value)                                                            AS min_value,
           MAX(value)                                                            AS max_value,
           COUNT(*)                                                              AS reading_count
      FROM sensor_readings
     WHERE sensor_id = ${sensor.id}
       AND captured_at >= ${from}
       AND captured_at <= ${to}
     GROUP BY day
     ORDER BY day ASC
  `;

  return {
    sensor_id: sensor.id,
    sensor_type: sensor.sensor_type,
    unit: sensor.unit,
    from,
    to,
    // A NULL day means CONVERT_TZ refused the offset; String(null) would put a literal
    // "null" bucket on the chart. Drop those rows instead of rendering a fake day.
    days: rows
      .filter((row) => row.day != null)
      .map((row) => ({
        // AVG/MIN/MAX arrive as Decimal and COUNT as BigInt over the raw driver, so every
        // field is coerced explicitly rather than trusted to serialise as a number.
        day: String(row.day),
        avg: Number(Number(row.avg_value).toFixed(2)),
        min: Number(Number(row.min_value).toFixed(2)),
        max: Number(Number(row.max_value).toFixed(2)),
        count: Number(row.reading_count),
      })),
  };
}

module.exports = {
  MAX_HISTORY_LIMIT,
  parseTimestamp,
  parseMessageId,
  validateReading,
  storeReading,
  storeReadings,
  ingestBatch,
  getHistory,
  recordHeartbeat,
  markStaleDevicesOffline,
  getDailySensorAverages,
};
