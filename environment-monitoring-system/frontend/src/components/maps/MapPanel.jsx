import Icon from '../common/Icons';

// Interactive city map drawn with plain SVG (no map library, no API key).
// Stations are positioned by normalising their latitude / longitude into the
// view box, so adding new stations works automatically.
//
//   props.markers : [{ id, code, name, x?, ... , color, label, value, inactive }]
//   props.selectedId / props.onSelect for click-highlighting

const W = 1000;
const H = 560;
const PAD = 70;

export default function MapPanel({ stations = [], selectedId, onSelect }) {
  if (stations.length === 0) {
    return <div className="empty">No stations to display.</div>;
  }

  const lats = stations.map((s) => s.lat);
  const lngs = stations.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const toXY = (station) => ({
    x: PAD + ((station.lng - minLng) / (maxLng - minLng || 1)) * (W - PAD * 2),
    y: PAD + ((maxLat - station.lat) / (maxLat - minLat || 1)) * (H - PAD * 2),
  });

  return (
    <div className="map-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="map-svg" role="img" aria-label="Map of monitoring stations">
        {/* land */}
        <rect x="0" y="0" width={W} height={H} rx="16" fill="#eef5ee" />

        {/* river running diagonally through the city */}
        <path
          d="M 180 -20 C 260 140, 420 200, 470 320 C 520 440, 700 500, 1040 470"
          stroke="#b9dcf0"
          strokeWidth="30"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 180 -20 C 260 140, 420 200, 470 320 C 520 440, 700 500, 1040 470"
          stroke="#9ccbe8"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 14"
        />

        {/* parks */}
        <ellipse cx="800" cy="150" rx="120" ry="80" fill="#d5ebd0" />
        <ellipse cx="330" cy="440" rx="95" ry="60" fill="#d5ebd0" />

        {/* roads */}
        <g stroke="#e2e7e4" strokeWidth="12" strokeLinecap="round">
          <line x1="0" y1="180" x2={W} y2="180" />
          <line x1="0" y1="380" x2={W} y2="380" />
          <line x1="300" y1="0" x2="300" y2={H} />
          <line x1="660" y1="0" x2="660" y2={H} />
        </g>
        <g stroke="#d7ded9" strokeWidth="4" strokeDasharray="10 12">
          <line x1="0" y1="180" x2={W} y2="180" />
          <line x1="660" y1="0" x2="660" y2={H} />
        </g>

        {/* station markers */}
        {stations.map((station) => {
          const { x, y } = toXY(station);
          const selected = station.id === selectedId;
          return (
            <g
              key={station.id}
              transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
              className="map-marker"
              onClick={() => onSelect && onSelect(station.id)}
            >
              <title>{`${station.name} — ${station.label}`}</title>
              {selected && <circle r="18" fill="none" stroke={station.color} strokeWidth="3" strokeDasharray="4 4" />}
              <circle r="13" fill={station.color} opacity="0.22" />
              <circle r="7" fill={station.color} stroke="#ffffff" strokeWidth="2.5" />
              <text y="26" textAnchor="middle" className="map-marker-label">
                {station.code}
              </text>
            </g>
          );
        })}

        {/* compass */}
        <g transform="translate(40, 62)" opacity="0.55">
          <line x1="0" y1="14" x2="0" y2="-14" stroke="#475569" strokeWidth="2" />
          <path d="M 0 -18 L 4 -10 L -4 -10 Z" fill="#475569" />
          <text x="0" y="30" textAnchor="middle" fontSize="11" fill="#475569">N</text>
        </g>
      </svg>

      <div className="map-legend">
        <span className="map-legend-title">
          <Icon name="pin" size={13} /> {stations.length} stations
        </span>
        <span className="muted">Click a marker to select the station</span>
      </div>
    </div>
  );
}
