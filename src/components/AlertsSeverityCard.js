import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const SEVERITY_META = {
  info: { label: 'Thông tin', color: '#909097' },
  warning: { label: 'Cảnh báo', color: '#7bd0ff' },
  critical: { label: 'Nghiêm trọng', color: '#ffb4ab' },
};

const TOOLTIP_STYLE = {
  background: '#122131',
  border: '1px solid rgba(69,70,77,0.4)',
  borderRadius: 8,
  color: '#d4e4fa',
};

function AlertsSeverityCard({ data }) {
  const total = data.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-1">Cảnh báo theo mức độ</h3>
      <p className="text-label-sm text-outline mb-4">7 ngày gần nhất</p>

      <div className="flex items-center gap-6">
        <div className="relative w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="severity"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {data.map(({ severity }) => (
                  <Cell key={severity} fill={SEVERITY_META[severity].color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [value, SEVERITY_META[name].label]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-headline-md font-bold text-on-surface">{total}</p>
            <p className="text-label-sm text-outline">cảnh báo</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {data.map(({ severity, count }) => (
            <div key={severity} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: SEVERITY_META[severity].color }}
              />
              <span className="text-body-md text-on-surface-variant">{SEVERITY_META[severity].label}</span>
              <span className="text-body-md font-semibold text-on-surface ml-auto">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AlertsSeverityCard;
