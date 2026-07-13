import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTemperatureHalf,
  faDroplet,
  faSun,
  faLightbulb,
  faFan,
  faLock,
  faBolt,
  faSatelliteDish,
  faFingerprint,
  faShieldHalved,
  faCouch,
  faKitchenSet,
  faBed,
  faTree,
  faMicrochip,
} from '@fortawesome/free-solid-svg-icons';
import useRouter from '~/hooks/useRouter';
import StatCard from '~/components/StatCard';
import EnvironmentStatusCard from '~/components/EnvironmentStatusCard';
import SecurityAlertsCard from '~/components/SecurityAlertsCard';
import QuickControlCard from '~/components/QuickControlCard';
import RoomCard from '~/components/RoomCard';
import DeviceListCard from '~/components/DeviceListCard';

const STATS = [
  {
    id: 'temperature',
    icon: faTemperatureHalf,
    label: 'Nhiệt độ',
    value: 24,
    unit: '°C',
    trend: '+0.5°C',
    trendClassName: 'text-tertiary',
    chartColor: '#4edea3',
    chartData: [
      { value: 22 }, { value: 23 }, { value: 22.5 }, { value: 24 },
      { value: 23.5 }, { value: 24.5 }, { value: 24 },
    ],
  },
  {
    id: 'humidity',
    icon: faDroplet,
    label: 'Độ ẩm',
    value: 65,
    unit: '%',
    trend: 'Ổn định',
    trendClassName: 'text-outline',
    chartColor: '#7bd0ff',
    chartData: [
      { value: 63 }, { value: 66 }, { value: 62 }, { value: 67 },
      { value: 64 }, { value: 68 }, { value: 65 },
    ],
  },
  {
    id: 'light',
    icon: faSun,
    label: 'Ánh sáng',
    value: 350,
    unit: ' lux',
    trend: '-10%',
    trendClassName: 'text-tertiary',
    chartColor: '#7bd0ff',
    chartData: [
      { value: 400 }, { value: 380 }, { value: 420 }, { value: 360 },
      { value: 390 }, { value: 340 }, { value: 350 },
    ],
  },
];

const INITIAL_CONTROLS = [
  { id: 1, icon: faLightbulb, label: 'Đèn Phòng Khách', onLabel: 'Đang bật', offLabel: 'Đang tắt', checked: true },
  { id: 2, icon: faFan, label: 'Quạt Nhà Bếp', onLabel: 'Đang bật', offLabel: 'Đang tắt', checked: false },
  { id: 3, icon: faLock, label: 'Cửa Trước', onLabel: 'Đã khóa', offLabel: 'Đã mở', checked: true },
  { id: 4, icon: faLightbulb, label: 'Đèn Sân Vườn', onLabel: 'Đang bật', offLabel: 'Đang tắt', checked: false },
];

const ROOMS = [
  { id: 'phong-khach', icon: faCouch, name: 'Phòng khách', deviceCount: 6 },
  { id: 'nha-bep', icon: faKitchenSet, name: 'Nhà bếp', deviceCount: 4 },
  { id: 'phong-ngu', icon: faBed, name: 'Phòng ngủ', deviceCount: 3 },
  { id: 'san-vuon', icon: faTree, name: 'Sân vườn', deviceCount: 2 },
];

const DEVICES = [
  { id: 1, icon: faLightbulb, name: 'Đèn Phòng Khách', room: 'Phòng khách', statusLabel: 'Đang bật', online: true },
  { id: 2, icon: faFan, name: 'Quạt Nhà Bếp', room: 'Nhà bếp', statusLabel: 'Đang tắt', online: true },
  { id: 3, icon: faLock, name: 'Cửa Trước', room: 'Lối vào', statusLabel: 'Đã khóa', online: true },
  { id: 4, icon: faMicrochip, name: 'Cảm biến nhiệt độ', room: 'Phòng khách', statusLabel: 'Mất kết nối', online: false },
  { id: 5, icon: faLightbulb, name: 'Đèn Sân Vườn', room: 'Sân vườn', statusLabel: 'Đang tắt', online: true },
];

const ALERTS = [
  {
    id: 1,
    icon: faSatelliteDish,
    tone: 'error',
    title: 'Phát hiện chuyển động tại Sân sau',
    meta: '2 phút trước • Camera số 4',
  },
  {
    id: 2,
    icon: faFingerprint,
    tone: 'secondary',
    title: 'Khóa cửa trước đã mở bằng vân tay',
    meta: '1 giờ trước • Người dùng: Anh Quân',
  },
  {
    id: 3,
    icon: faShieldHalved,
    tone: 'tertiary',
    title: 'Hệ thống báo động đã được kích hoạt',
    meta: '4 giờ trước • Tự động',
  },
];

function HomePage() {
  const [controls, setControls] = useState(INITIAL_CONTROLS);
  const router = useRouter();

  const toggleControl = (id) => {
    setControls((prev) =>
      prev.map((control) => (control.id === id ? { ...control, checked: !control.checked } : control))
    );
  };

  return (
    <div className="p-6 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STATS.map((stat) => (
              <StatCard key={stat.id} {...stat} />
            ))}
          </div>

          <div>
            <p className="flex items-center gap-2 text-label-sm text-outline tracking-wide mb-3">
              <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5" />
              ĐIỀU KHIỂN NHANH
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {controls.map(({ id, icon, label, onLabel, offLabel, checked }) => (
                <QuickControlCard
                  key={id}
                  icon={icon}
                  label={label}
                  status={checked ? onLabel : offLabel}
                  checked={checked}
                  onToggle={() => toggleControl(id)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-label-sm text-outline tracking-wide mb-3">PHÒNG</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {ROOMS.map(({ id, icon, name, deviceCount }) => (
                <RoomCard
                  key={id}
                  icon={icon}
                  name={name}
                  deviceCount={deviceCount}
                  onClick={() => router.navigate(`/phong?id=${id}`)}
                />
              ))}
            </div>
          </div>

          <DeviceListCard devices={DEVICES} />
        </div>

        <div className="flex flex-col gap-6">
          <EnvironmentStatusCard
            title="An Toàn"
            description="Môi trường trong lành, không có cảnh báo vượt ngưỡng. Chỉ số AQI hiện tại là 12 (Rất tốt)."
          />
          <SecurityAlertsCard alerts={ALERTS} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
