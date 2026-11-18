import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Multi-series line chart for historical trends.
//   data : [{ label, pm25, pm10, ... }]
//   lines: [{ key, name, color }]
export default function TrendChart({ data, lines, height = 280, yLabel }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e4eae6' }}
          minTickGap={26}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={46}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }
              : undefined
          }
        />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4eae6', fontSize: 12.5 }} />
        <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="circle" iconSize={8} />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
