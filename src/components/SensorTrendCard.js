import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const AXIS_TICK = { fill: '#909097', fontSize: 12 };
const TOOLTIP_STYLE = {
  background: '#122131',
  border: '1px solid rgba(69,70,77,0.4)',
  borderRadius: 8,
  color: '#d4e4fa',
};

function SensorTrendCard({ data }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-1">Xu hướng cảm biến</h3>
      <p className="text-label-sm text-outline mb-4">7 ngày gần nhất</p>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#1c2b3c" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: '#1c2b3c' }} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            axisLine={{ stroke: '#1c2b3c' }}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            axisLine={{ stroke: '#1c2b3c' }}
            tickLine={false}
            width={36}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#d4e4fa' }} />
          <Legend wrapperStyle={{ color: '#c6c6cd', fontSize: 13 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temperature"
            name="Nhiệt độ (°C)"
            stroke="#4edea3"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="humidity"
            name="Độ ẩm (%)"
            stroke="#7bd0ff"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="light"
            name="Ánh sáng (lux)"
            stroke="#bec6e0"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SensorTrendCard;
