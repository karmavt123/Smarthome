const prisma = require('../config/prisma');

const ACTIVE_ALERT_STATUSES = ['unread', 'read'];

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

      results.push({ ruleId: rule.id, transition: 'triggered', alert });
    } else if (!triggered && activeAlert) {
      const alert = await prisma.alerts.update({
        where: { id: activeAlert.id },
        data: { status: 'resolved', updated_at: new Date() },
      });
      results.push({ ruleId: rule.id, transition: 'resolved', alert });
    }
  }

  return results;
}

module.exports = { ACTIVE_ALERT_STATUSES, compareValue, evaluateReading };
