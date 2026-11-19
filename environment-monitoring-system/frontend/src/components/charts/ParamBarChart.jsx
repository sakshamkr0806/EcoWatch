import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// One bar per parameter. data: [{ name, value, color }]
export default function ParamBarChart({ data, height = 250 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e4eae6' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          cursor={{ fill: 'rgba(21,128,61,0.05)' }}
          formatter={(v) => [`${v} / 500`, 'Sub-index']}
          contentStyle={{ borderRadius: 10, border: '1px solid #e4eae6', fontSize: 12.5 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={58}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
