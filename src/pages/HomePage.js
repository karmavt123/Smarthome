import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTemperatureHalf,
  faDroplet,
  faSun,
  faBolt,
  faFingerprint,
  faSatelliteDish,
  faMicrochip,
  faCouch,
  faKitchenSet,
  faBed,
  faTree,
  faDoorOpen,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import useRouter from '~/hooks/useRouter';
import useHome from '~/hooks/useHome';
import useDeviceCommand from '~/hooks/useDeviceCommand';
import dashboardService from '~/services/dashboardService';
import formatRelativeTime from '~/utils/formatRelativeTime';
import {
  CONTROLLABLE_TYPES,
  DEVICE_TYPE_ICON,
  isDeviceOn,
  getNextAction,
  getStatusLabel,
} from '~/utils/deviceStatus';
import StatCard from '~/components/StatCard';
import EnvironmentStatusCard from '~/components/EnvironmentStatusCard';
import SecurityAlertsCard from '~/components/SecurityAlertsCard';
import QuickControlCard from '~/components/QuickControlCard';
import RoomCard from '~/components/RoomCard';
import DeviceListCard from '~/components/DeviceListCard';

const REFRESH_INTERVAL_MS = 5000;

const SENSOR_META = {
  temperature: { icon: faTemperatureHalf, label: 'Nhiệt độ', chartColor: '#4edea3', decimals: 1 },
  humidity: { icon: faDroplet, label: 'Độ ẩm', chartColor: '#7bd0ff', decimals: 0 },
  light: { icon: faSun, label: 'Ánh sáng', chartColor: '#7bd0ff', decimals: 0 },
};

const ROOM_ICON_RULES = [
  { keywords: ['khách'], icon: faCouch },
  { keywords: ['ngủ'], icon: faBed },
  { keywords: ['bếp'], icon: faKitchenSet },
  { keywords: ['vườn', 'sân'], icon: faTree },
];

const ALERT_TYPE_ICON = {
  environment: faTemperatureHalf,
  unauthorized_access: faFingerprint,
  device_offline: faSatelliteDish,
};

const ALERT_SEVERITY_TONE = { critical: 'error', warning: 'secondary', info: 'tertiary' };

function getRoomIcon(name) {
  const lower = name.toLowerCase();
  const rule = ROOM_ICON_RULES.find(({ keywords }) => keywords.some((k) => lower.includes(k)));
  return rule ? rule.icon : faDoorOpen;
}

function buildStat(sensorType, sensor) {
  const meta = SENSOR_META[sensorType];
  const history = sensor.history || [];
  const first = history[0]?.value ?? sensor.value;
  const diff = sensor.value - first;
  const isStable = Math.abs(diff) < (sensorType === 'temperature' ? 0.5 : 3);

  return {
    id: sensorType,
    icon: meta.icon,
    label: meta.label,
    value: sensor.value,
    unit: sensorType === 'light' ? ` ${sensor.unit}` : sensor.unit,
    trend: isStable ? 'Ổn định' : `${diff > 0 ? '+' : ''}${diff.toFixed(meta.decimals)}${sensor.unit}`,
    trendClassName: isStable ? 'text-outline' : 'text-tertiary',
    chartColor: meta.chartColor,
    chartData: history.map(({ value }) => ({ value })),
  };
}

function HomePage() {
  const router = useRouter();
  const { currentHomeId } = useHome();
  const { toggle, getOptimisticAction, errorFor } = useDeviceCommand();

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await dashboardService.get(currentHomeId);
      setDashboard(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu, thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleToggle = (device) => {
    const nextAction = getNextAction(device, getOptimisticAction(device.id));
    toggle(device.id, nextAction, { onSettled: () => fetchDashboard() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (loadError && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-body-md text-error">{loadError}</p>
      </div>
    );
  }

  const stats = Object.entries(dashboard.environment)
    .filter(([sensorType]) => SENSOR_META[sensorType])
    .map(([sensorType, sensor]) => buildStat(sensorType, sensor));

  const controllableDevices = dashboard.devices.filter((d) => CONTROLLABLE_TYPES.includes(d.deviceType));

  const roomDeviceCounts = dashboard.devices.reduce((acc, device) => {
    if (!device.room) return acc;
    acc[device.room.id] = (acc[device.room.id] || 0) + 1;
    return acc;
  }, {});

  const activeAlerts = dashboard.alerts.filter((a) => a.status !== 'resolved');
  const environmentDescription =
    activeAlerts.length === 0
      ? 'Môi trường trong lành, không có cảnh báo nào đang hoạt động.'
      : `${activeAlerts.length} cảnh báo đang hoạt động: ${activeAlerts.map((a) => a.title).join(', ')}`;

  const alertItems = dashboard.alerts.map((alert) => ({
    id: alert.id,
    icon: ALERT_TYPE_ICON[alert.alertType] || faSatelliteDish,
    tone: ALERT_SEVERITY_TONE[alert.severity] || 'secondary',
    title: alert.title,
    meta: `${formatRelativeTime(alert.createdAt)} • ${alert.message}`,
  }));

  const deviceListItems = dashboard.devices.map((device) => ({
    id: device.id,
    icon: DEVICE_TYPE_ICON[device.deviceType] || faMicrochip,
    name: device.name,
    room: device.room?.name || 'Chưa gán phòng',
    statusLabel: getStatusLabel(device, getOptimisticAction(device.id)),
    online: device.connectionStatus === 'online',
  }));

  return (
    <div className="p-6 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <StatCard key={stat.id} {...stat} />
            ))}
          </div>

          <div>
            <p className="flex items-center gap-2 text-label-sm text-outline tracking-wide mb-3">
              <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5" />
              ĐIỀU KHIỂN NHANH
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {controllableDevices.map((device) => {
                const optimisticAction = getOptimisticAction(device.id);
                return (
                  <QuickControlCard
                    key={device.id}
                    icon={DEVICE_TYPE_ICON[device.deviceType]}
                    label={device.name}
                    status={getStatusLabel(device, optimisticAction)}
                    checked={isDeviceOn(device, optimisticAction)}
                    error={errorFor(device.id)}
                    onToggle={() => handleToggle(device)}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-label-sm text-outline tracking-wide mb-3">PHÒNG</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {dashboard.rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  icon={getRoomIcon(room.name)}
                  name={room.name}
                  deviceCount={roomDeviceCounts[room.id] || 0}
                  onClick={() => router.navigate(`/phong?roomId=${room.id}`)}
                />
              ))}
            </div>
          </div>

          <DeviceListCard devices={deviceListItems} />
        </div>

        <div className="flex flex-col gap-6">
          <EnvironmentStatusCard status={dashboard.environmentStatus} description={environmentDescription} />
          <SecurityAlertsCard alerts={alertItems} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
