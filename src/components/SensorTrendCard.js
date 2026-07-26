import SensorTrendMetricChart from '~/components/SensorTrendMetricChart';

// One chart per metric, each on its own axis — a shared dual-axis chart (°C and %
// and lux on the same plot) invents a correlation from arbitrary scale alignment.
// Colors validated via dataviz skill's validate_palette.js (dark mode, categorical,
// all checks pass) — semantically: orange=heat, blue=water, amber=light.
const METRICS = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', color: '#d95926' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%', color: '#3987e5' },
  { key: 'light', label: 'Ánh sáng', unit: 'lux', color: '#c98500' },
];

function SensorTrendCard({ data }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-1">Xu hướng cảm biến</h3>
      <p className="text-label-sm text-outline mb-4">Trung bình theo ngày, 7 ngày gần nhất</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {METRICS.map((metric) => (
          <SensorTrendMetricChart key={metric.key} data={data} metricKey={metric.key} {...metric} />
        ))}
      </div>
    </div>
  );
}

export default SensorTrendCard;
