import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useHome from '~/hooks/useHome';
import dashboardService from '~/services/dashboardService';
import telemetryService from '~/services/telemetryService';
import deviceActionService from '~/services/deviceActionService';
import alertService from '~/services/alertService';
import SensorTrendCard from '~/components/SensorTrendCard';
import DeviceActivityCard from '~/components/DeviceActivityCard';
import AlertsSeverityCard from '~/components/AlertsSeverityCard';

const TREND_DAYS = 7;
const SENSOR_TYPES = ['temperature', 'humidity', 'light'];
const CONTROL_METHODS = ['app', 'voice', 'face', 'automatic', 'manual'];

// Group by UTC calendar day (not local time) so the bucket key is a plain
// string comparison — reformatting it as dd/mm via string split avoids the
// classic "new Date('YYYY-MM-DD') shifts a day in negative-UTC timezones" bug.
function dayKey(isoDate) {
  return isoDate.slice(0, 10);
}

function formatDayLabel(key) {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

function buildSensorTrend(readingsBySensorType) {
  const byDay = {};

  SENSOR_TYPES.forEach((sensorType) => {
    const sums = {};
    (readingsBySensorType[sensorType] || []).forEach(({ value, capturedAt }) => {
      const key = dayKey(capturedAt);
      if (!sums[key]) sums[key] = { total: 0, count: 0 };
      sums[key].total += value;
      sums[key].count += 1;
    });
    Object.entries(sums).forEach(([key, { total, count }]) => {
      if (!byDay[key]) byDay[key] = { key };
      byDay[key][sensorType] = Number((total / count).toFixed(1));
    });
  });

  return Object.values(byDay)
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(({ key, ...rest }) => ({ date: formatDayLabel(key), ...rest }));
}

function buildDeviceActivity(actions) {
  const byDay = {};

  actions.forEach(({ createdAt, controlMethod }) => {
    const key = dayKey(createdAt);
    if (!byDay[key]) {
      byDay[key] = { key };
      CONTROL_METHODS.forEach((method) => {
        byDay[key][method] = 0;
      });
    }
    if (CONTROL_METHODS.includes(controlMethod)) byDay[key][controlMethod] += 1;
  });

  return Object.values(byDay)
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(({ key, ...rest }) => ({ date: formatDayLabel(key), ...rest }));
}

function buildAlertsSeverity(alerts) {
  const counts = alerts.reduce((acc, { severity }) => {
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([severity, count]) => ({ severity, count }));
}

function StatisticsPage() {
  const { currentHomeId } = useHome();
  const [sensorTrend, setSensorTrend] = useState([]);
  const [deviceActivity, setDeviceActivity] = useState([]);
  const [alertsSeverity, setAlertsSeverity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const dashboard = await dashboardService.get(currentHomeId);

      const now = new Date();
      const from = new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const readingsEntries = await Promise.all(
        SENSOR_TYPES.map(async (sensorType) => {
          const sensorId = dashboard.environment?.[sensorType]?.sensorId;
          if (!sensorId) return [sensorType, []];
          const { readings } = await telemetryService.getSensorReadings(sensorId, { from, to, limit: 500 });
          return [sensorType, readings];
        })
      );

      const [actions, alertsRes] = await Promise.all([
        deviceActionService.list({ home_id: currentHomeId }),
        alertService.listAlerts({ home_id: currentHomeId, limit: 1000 }),
      ]);

      setSensorTrend(buildSensorTrend(Object.fromEntries(readingsEntries)));
      setDeviceActivity(buildDeviceActivity(actions));
      setAlertsSeverity(buildAlertsSeverity(alertsRes.data));
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu thống kê.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-body-md text-error">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <h1 className="text-headline-md font-semibold text-on-surface">Thống kê</h1>

      <SensorTrendCard data={sensorTrend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceActivityCard data={deviceActivity} />
        <AlertsSeverityCard data={alertsSeverity} />
      </div>
    </div>
  );
}

export default StatisticsPage;
