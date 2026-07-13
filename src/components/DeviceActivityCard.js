import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AXIS_TICK = { fill: '#909097', fontSize: 12 };
const TOOLTIP_STYLE = {
  background: '#122131',
  border: '1px solid rgba(69,70,77,0.4)',
  borderRadius: 8,
  color: '#d4e4fa',
};

const METHODS = [
  { key: 'app', name: 'App', color: '#7bd0ff' },
  { key: 'voice', name: 'Giọng nói', color: '#4edea3' },
  { key: 'face', name: 'Face ID', color: '#bec6e0' },
  { key: 'automatic', name: 'Tự động', color: '#565e74' },
  { key: 'manual', name: 'Thủ công', color: '#909097' },
];

function DeviceActivityCard({ data }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-1">Hoạt động thiết bị</h3>
      <p className="text-label-sm text-outline mb-4">Số lệnh điều khiển theo phương thức, 7 ngày gần nhất</p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#1c2b3c" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: '#1c2b3c' }} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={{ stroke: '#1c2b3c' }} tickLine={false} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#d4e4fa' }} cursor={{ fill: 'rgba(123,208,255,0.06)' }} />
          <Legend wrapperStyle={{ color: '#c6c6cd', fontSize: 13 }} />
          {METHODS.map(({ key, name, color }) => (
            <Bar key={key} dataKey={key} name={name} stackId="a" fill={color} radius={0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DeviceActivityCard;
