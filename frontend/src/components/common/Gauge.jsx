// Semi-circular gauge drawn with plain SVG.
// Used for AQI (0-500) and WQI (0-100). `zones` are the coloured bands,
// each defined by its cumulative upper limit and colour.

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, a0, a1) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export default function Gauge({ value, max = 100, zones = [], label = '', category = '', color = '#16a34a' }) {
  const W = 250;
  const H = 152;
  const cx = W / 2;
  const cy = H - 12;
  const R = 104;

  const frac = Math.min(Math.max(value / max, 0), 1);
  const needleDeg = 180 + frac * 180; // 180° = far left, 360° = far right
  const needleTip = polar(cx, cy, R - 30, needleDeg);

  let prev = 0;
  return (
    <div className="gauge-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="gauge-svg" role="img" aria-label={`${label} gauge showing ${Math.round(value)}`}>
        {zones.map((zone, i) => {
          const a0 = 180 + (prev / max) * 180;
          const a1 = 180 + (zone.limit / max) * 180;
          prev = zone.limit;
          return (
            <path
              key={i}
              d={arcPath(cx, cy, R, a0 + 0.8, a1 - 0.8)}
              stroke={zone.color}
              strokeWidth="16"
              fill="none"
              strokeLinecap="butt"
            />
          );
        })}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="#1f2937" />
        <text x="16" y={H - 4} className="gauge-tick">0</text>
        <text x={W - 8} y={H - 4} textAnchor="end" className="gauge-tick">{max}</text>
        <text x={cx} y={cy - 34} textAnchor="middle" className="gauge-value">
          {value != null ? Math.round(value) : '—'}
        </text>
        <text x={cx} y={cy - 14} textAnchor="middle" className="gauge-unit">{label}</text>
      </svg>
      {category && (
        <div className="gauge-category" style={{ color }}>
          {category}
        </div>
      )}
    </div>
  );
}
