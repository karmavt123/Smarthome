import SensorTrendCard from '~/components/SensorTrendCard';
import DeviceActivityCard from '~/components/DeviceActivityCard';
import AlertsSeverityCard from '~/components/AlertsSeverityCard';

const SENSOR_TREND = [
  { date: '27/09', temperature: 23.5, humidity: 52, light: 320 },
  { date: '28/09', temperature: 24.1, humidity: 50, light: 340 },
  { date: '29/09', temperature: 22.8, humidity: 55, light: 290 },
  { date: '30/09', temperature: 25.2, humidity: 48, light: 410 },
  { date: '01/10', temperature: 24.6, humidity: 49, light: 380 },
  { date: '02/10', temperature: 24.0, humidity: 65, light: 350 },
  { date: '03/10', temperature: 23.2, humidity: 58, light: 300 },
];

const DEVICE_ACTIVITY = [
  { date: '27/09', app: 8, voice: 2, face: 1, automatic: 4, manual: 0 },
  { date: '28/09', app: 6, voice: 3, face: 2, automatic: 5, manual: 1 },
  { date: '29/09', app: 10, voice: 1, face: 0, automatic: 3, manual: 0 },
  { date: '30/09', app: 7, voice: 4, face: 2, automatic: 6, manual: 0 },
  { date: '01/10', app: 9, voice: 2, face: 3, automatic: 4, manual: 1 },
  { date: '02/10', app: 12, voice: 3, face: 4, automatic: 5, manual: 0 },
  { date: '03/10', app: 5, voice: 1, face: 1, automatic: 3, manual: 0 },
];

const ALERTS_SEVERITY = [
  { severity: 'info', count: 6 },
  { severity: 'warning', count: 9 },
  { severity: 'critical', count: 2 },
];

function StatisticsPage() {
  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <h1 className="text-headline-md font-semibold text-on-surface">Thống kê</h1>

      <SensorTrendCard data={SENSOR_TREND} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceActivityCard data={DEVICE_ACTIVITY} />
        <AlertsSeverityCard data={ALERTS_SEVERITY} />
      </div>
    </div>
  );
}

export default StatisticsPage;
