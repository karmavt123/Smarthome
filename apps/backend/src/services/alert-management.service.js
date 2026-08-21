const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { requireHome, requireSensor } = require('./ownership.service');

const OPERATOR_MAP = {
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  '=': 'eq',
  gt: 'gt',
  lt: 'lt',
  gte: 'gte',
  lte: 'lte',
  eq: 'eq',
};
const SEVERITIES = ['info', 'warning', 'critical'];

async function resolveHome(userId, homeId) {
  if (homeId) return requireHome(userId, homeId);
  const home = await prisma.homes.findFirst({ where: { user_id: Number(userId) } });
  if (!home) throw new HttpError(404, 'Home not found');
  return home;
}

async function listAlertRules(userId, homeId) {
  const home = await resolveHome(userId, homeId);
  return prisma.alert_rules.findMany({
    where: { home_id: home.id },
    include: { sensors: { include: { devices: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createAlertRule(userId, payload) {
  const { home_id, sensor_id, name, condition_operator, threshold_value, severity } = payload;
  if (!home_id || !sensor_id || !name) {
    throw new HttpError(400, 'homeId, sensorId, and name are required');
  }

  const home = await requireHome(userId, home_id);
  const sensor = await requireSensor(userId, sensor_id, { devices: true });
  if (sensor.devices.home_id !== home.id) {
    throw new HttpError(400, 'Sensor does not belong to the selected home');
  }

  const operator = OPERATOR_MAP[condition_operator];
  if (!operator) throw new HttpError(400, 'Unsupported conditionOperator');
  const threshold = Number(threshold_value);
  if (!Number.isFinite(threshold)) throw new HttpError(400, 'thresholdValue must be numeric');
  if (!SEVERITIES.includes(severity || 'warning')) {
    throw new HttpError(400, `severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  return prisma.alert_rules.create({
    data: {
      home_id: home.id,
      sensor_id: sensor.id,
      name: String(name).trim(),
      condition_operator: operator,
      threshold_value: threshold,
      severity: severity || 'warning',
    },
  });
}

async function updateAlertRule(userId, ruleId, payload) {
  const rule = await prisma.alert_rules.findFirst({
    where: { id: Number(ruleId), homes: { user_id: Number(userId) } },
  });
  if (!rule) throw new HttpError(404, 'Alert rule not found');

  const data = {};
  if (payload.name != null) data.name = String(payload.name).trim();
  if (payload.is_active != null) data.is_active = Boolean(payload.is_active);
  if (payload.condition_operator != null) {
    data.condition_operator = OPERATOR_MAP[payload.condition_operator];
    if (!data.condition_operator) throw new HttpError(400, 'Unsupported conditionOperator');
  }
  if (payload.threshold_value != null) {
    data.threshold_value = Number(payload.threshold_value);
    if (!Number.isFinite(data.threshold_value)) {
      throw new HttpError(400, 'thresholdValue must be numeric');
    }
  }
  if (payload.severity != null) {
    if (!SEVERITIES.includes(payload.severity)) {
      throw new HttpError(400, `severity must be one of: ${SEVERITIES.join(', ')}`);
    }
    data.severity = payload.severity;
  }

  return prisma.alert_rules.update({ where: { id: rule.id }, data });
}

async function deleteAlertRule(userId, ruleId) {
  const rule = await prisma.alert_rules.findFirst({
    where: { id: Number(ruleId), homes: { user_id: Number(userId) } },
  });
  if (!rule) throw new HttpError(404, 'Alert rule not found');

  try {
    await prisma.alert_rules.delete({ where: { id: rule.id } });
  } catch (error) {
    if (error.code === 'P2003') {
      throw new HttpError(409, 'Cannot delete a rule that already has alerts; deactivate it instead');
    }
    throw error;
  }
}

async function listAlerts(userId, query = {}) {
  const home = await resolveHome(userId, query.home_id);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const where = {
    home_id: home.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.severity ? { severity: query.severity } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.alerts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.alerts.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, total_pages: total === 0 ? 0 : Math.ceil(total / limit) },
  };
}

function parseAlertId(alertId) {
  try {
    return BigInt(alertId);
  } catch {
    throw new HttpError(400, 'Invalid alert id');
  }
}

async function getAlert(userId, alertId) {
  const alert = await prisma.alerts.findFirst({
    where: { id: parseAlertId(alertId), homes: { user_id: Number(userId) } },
  });
  if (!alert) throw new HttpError(404, 'Alert not found');
  return alert;
}

async function updateAlert(userId, alertId, status) {
  if (!['unread', 'read', 'resolved'].includes(status)) {
    throw new HttpError(400, 'status must be unread, read, or resolved');
  }
  const alert = await getAlert(userId, alertId);
  return prisma.alerts.update({
    where: { id: alert.id },
    data: { status, updated_at: new Date() },
  });
}

module.exports = {
  OPERATOR_MAP,
  SEVERITIES,
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listAlerts,
  getAlert,
  updateAlert,
};
