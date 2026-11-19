import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

// Donut chart for category distributions. data: [{ name, value, color }]
export default function DonutChart({ data, height = 240 }) {
  const hasData = data && data.some((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      {hasData ? (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="80%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [v, name]}
            contentStyle={{ borderRadius: 10, border: '1px solid #e4eae6', fontSize: 12.5 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        </PieChart>
      ) : (
        <div className="empty" style={{ height: '100%' }}>No data for this period</div>
      )}
    </ResponsiveContainer>
  );
}
