import { LineChart, Line, ResponsiveContainer } from 'recharts';

function Sparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default Sparkline;
