import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useHome from '~/hooks/useHome';
import useAlerts from '~/hooks/useAlerts';
import telemetryService from '~/services/telemetryService';
import deviceActionService from '~/services/deviceActionService';
import alertService from '~/services/alertService';
import environmentService from '~/services/environmentService';
import SensorTrendCard from '~/components/SensorTrendCard';
import DeviceActivityCard from '~/components/DeviceActivityCard';
import AlertsSeverityCard from '~/components/AlertsSeverityCard';

const TREND_DAYS = 7;
const SENSOR_TYPES = ['temperature', 'humidity', 'light'];
// Phai khop voi enum device_actions.control_method cua backend. 'password' tung bi bo
// sot o day, va vi dong 72 chi cong don khi method nam trong danh sach nay nen moi lenh
// mo cua bang ma PIN bi am tham loai khoi bieu do thay vi hien sai — khong co dau hieu gi.
const CONTROL_METHODS = ['app', 'voice', 'face', 'password', 'automatic', 'manual'];

// The daily-average endpoint already returns a plain "YYYY-MM-DD" bucketed in the report
// timezone, so that one is used as-is.
function dayKey(isoDate) {
  return isoDate.slice(0, 10);
}

// Device actions arrive as full UTC timestamps and are bucketed here, so they have to be
// converted to the viewer's calendar day first — otherwise anything logged between
// midnight and 07:00 in Vietnam landed on the previous day's column, disagreeing with the
// sensor chart right next to it. Kept as YYYY-MM-DD so the key still sorts as a string.
function localDayKey(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return String(isoTimestamp).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(key) {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

// Input is already one row per day per sensor (GET /sensors/:id/readings/daily), so this
// only pivots the three series onto a shared day axis. The averaging used to happen here
// over raw readings, which silently covered only whatever fit in the 500-row cap — with
// a reading every few seconds that was a couple of hours, not the 7 days on the label.
function buildSensorTrend(dailyBySensorType) {
  const byDay = {};

  SENSOR_TYPES.forEach((sensorType) => {
    (dailyBySensorType[sensorType] || []).forEach(({ day, avg }) => {
      const key = dayKey(day);
      if (!byDay[key]) byDay[key] = { key };
      byDay[key][sensorType] = Number(Number(avg).toFixed(1));
    });
  });

  return Object.values(byDay)
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(({ key, ...rest }) => ({ date: formatDayLabel(key), ...rest }));
}

function buildDeviceActivity(actions) {
  const byDay = {};

  actions.forEach(({ createdAt, controlMethod }) => {
    const key = localDayKey(createdAt);
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
  const { setAlerts } = useAlerts();
  const [sensorTrend, setSensorTrend] = useState([]);
  const [deviceActivity, setDeviceActivity] = useState([]);
  const [alertsSeverity, setAlertsSeverity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const environmentRes = await environmentService.get(currentHomeId);
      const environmentData = environmentRes.environment;

      const now = new Date();
      const from = new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const dailyEntries = await Promise.all(
        SENSOR_TYPES.map(async (sensorType) => {
          const sensorId = environmentData?.[sensorType]?.sensorId;
          if (!sensorId) return [sensorType, []];
          const { days } = await telemetryService.getDailyAverages(sensorId, { from, to });
          return [sensorType, days];
        })
      );

      // from/to are passed through now that the backend filters on them. Before this,
      // both endpoints just returned the N newest rows with no date bound at all, so the
      // cards saying "7 ngày gần nhất" were really showing "the last 50 commands" and
      // "the last 200 alerts" — on a busy home that could be a couple of hours.
      const [actions, alertsRes] = await Promise.all([
        deviceActionService.list({ home_id: currentHomeId, from, to, limit: 200 }),
        alertService.getAll(currentHomeId, { from, to, limit: 200 }),
      ]);

      setSensorTrend(buildSensorTrend(Object.fromEntries(dailyEntries)));
      setDeviceActivity(buildDeviceActivity(actions));
      setAlerts(alertsRes.data);
      setAlertsSeverity(buildAlertsSeverity(alertsRes.data));
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu thống kê.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId, setAlerts]);

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
