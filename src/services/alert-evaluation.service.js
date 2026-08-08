const prisma = require('../config/prisma');
const sseService = require('./sse.service');

const ACTIVE_ALERT_STATUSES = ['unread', 'read'];
const DOOR_FAILURE_THRESHOLD = 3;
const DOOR_FAILURE_WINDOW_MS = 2 * 60 * 1000;

function compareValue(value, operator, threshold) {
  const numericValue = Number(value);
  const numericThreshold = Number(threshold);

  switch (operator) {
    case 'gt':
    case '>':
      return numericValue > numericThreshold;
    case 'lt':
    case '<':
      return numericValue < numericThreshold;
    case 'gte':
    case '>=':
      return numericValue >= numericThreshold;
    case 'lte':
    case '<=':
      return numericValue <= numericThreshold;
    case 'eq':
    case '=':
      return numericValue === numericThreshold;
    default:
      throw new Error(`Unsupported alert operator: ${operator}`);
  }
}

function publishAlert(userId, alert, transition) {
  sseService.publish(userId, 'alert', {
    alert_id: alert.id,
    home_id: alert.home_id,
    alert_type: alert.alert_type,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    message: alert.message,
    transition,
  });
}

async function evaluateReading(sensor, value) {
  const rules = await prisma.alert_rules.findMany({
    where: { sensor_id: sensor.id, is_active: true },
    include: { homes: true },
  });

  const results = [];

  for (const rule of rules) {
    const triggered = compareValue(value, rule.condition_operator, rule.threshold_value);
    const activeAlert = await prisma.alerts.findFirst({
      where: {
        alert_rule_id: rule.id,
        status: { in: ACTIVE_ALERT_STATUSES },
      },
      orderBy: { created_at: 'desc' },
    });

    if (triggered && !activeAlert) {
      const title = rule.name;
      const message = `${sensor.sensor_type} is ${value}${sensor.unit}; threshold is ${rule.condition_operator} ${rule.threshold_value}${sensor.unit}.`;

      const alert = await prisma.$transaction(async (tx) => {
        const createdAlert = await tx.alerts.create({
          data: {
            home_id: rule.home_id,
            alert_rule_id: rule.id,
            alert_type: 'environment',
            severity: rule.severity,
            title,
            message,
          },
        });

        await tx.notifications.create({
          data: {
            user_id: rule.homes.user_id,
            alert_id: createdAlert.id,
            title,
            message,
            channel: 'in_app',
            status: 'sent',
          },
        });

        return createdAlert;
      });

      publishAlert(rule.homes.user_id, alert, 'triggered');
      results.push({ ruleId: rule.id, transition: 'triggered', alert });
    } else if (!triggered && activeAlert) {
      const alert = await prisma.alerts.update({
        where: { id: activeAlert.id },
        data: { status: 'resolved', updated_at: new Date() },
      });
      publishAlert(rule.homes.user_id, alert, 'resolved');
      results.push({ ruleId: rule.id, transition: 'resolved', alert });
    }
  }

  return results;
}

async function evaluateDoorAccessFailures(device, accessMethod) {
  const since = new Date(Date.now() - DOOR_FAILURE_WINDOW_MS);
  const recentFailures = await prisma.door_access_logs.count({
    where: {
      door_device_id: device.id,
      access_method: accessMethod,
      result: 'failed',
      created_at: { gte: since },
    },
  });

  if (recentFailures < DOOR_FAILURE_THRESHOLD) return null;

  const doorTag = `[door:${device.id}]`;
  const existingActiveAlert = await prisma.alerts.findFirst({
    where: {
      home_id: device.home_id,
      alert_type: 'unauthorized_access',
      status: { in: ACTIVE_ALERT_STATUSES },
      message: { contains: doorTag },
    },
  });
  if (existingActiveAlert) return null;

  const title = `Nhiều lần mở cửa thất bại tại "${device.name}"`;
  const message = `${doorTag} Phát hiện ${recentFailures} lần xác thực ${accessMethod} thất bại liên tiếp trong vòng ${DOOR_FAILURE_WINDOW_MS / 60000} phút tại cửa "${device.name}".`;

  const { alert, home } = await prisma.$transaction(async (tx) => {
    const alert = await tx.alerts.create({
      data: {
        home_id: device.home_id,
        alert_type: 'unauthorized_access',
        severity: 'critical',
        title,
        message,
      },
    });

    const home = await tx.homes.findUniqueOrThrow({ where: { id: device.home_id } });
    await tx.notifications.create({
      data: {
        user_id: home.user_id,
        alert_id: alert.id,
        title,
        message,
        channel: 'in_app',
        status: 'sent',
      },
    });

    return { alert, home };
  });

  publishAlert(home.user_id, alert, 'triggered');
  return alert;
}

module.exports = {
  ACTIVE_ALERT_STATUSES,
  DOOR_FAILURE_THRESHOLD,
  DOOR_FAILURE_WINDOW_MS,
  compareValue,
  evaluateReading,
  evaluateDoorAccessFailures,
};
