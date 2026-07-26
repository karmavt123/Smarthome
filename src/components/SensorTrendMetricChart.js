import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AXIS_TICK = { fill: '#909097', fontSize: 11 };
const TOOLTIP_STYLE = {
  background: '#122131',
  border: '1px solid rgba(69,70,77,0.4)',
  borderRadius: 8,
  color: '#d4e4fa',
};

function SensorTrendMetricChart({ data, metricKey, label, unit, color }) {
  return (
    <div>
      <p className="text-label-md font-medium text-on-surface-variant mb-2">
        {label} <span className="text-outline">({unit})</span>
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1c2b3c" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: '#1c2b3c' }} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={{ stroke: '#1c2b3c' }} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#d4e4fa' }}
            formatter={(value) => [`${value} ${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey={metricKey}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: color, stroke: '#122131', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SensorTrendMetricChart;
