import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import useFetch from '../hooks/useFetch';
import { airService } from '../services/air.service';
import Card from '../components/common/Card';
import Gauge from '../components/common/Gauge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Icon from '../components/common/Icons';
import TrendChart from '../components/charts/TrendChart';
import ParamBarChart from '../components/charts/ParamBarChart';
import { POLLUTANTS, AQI_SCALE, getAQICategory, subIndex, aqiZones } from '../utils/aqi';
import { formatDateTime, timeAgo } from '../utils/format';

const LINE_COLORS = { pm25: '#dc2626', pm10: '#d97706', no2: '#0ea5e9', so2: '#16a34a' };
const RANGES = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

export default function AirQuality() {
  const { stations } = useData();
  const airStations = stations.filter((s) => (s.type === 'AIR' || s.type === 'BOTH') && s.status !== 'INACTIVE');

  const [stationId, setStationId] = useState('');
  const [hours, setHours] = useState(24);

  // Default to the first station once the list arrives.
  useEffect(() => {
    if (!stationId && airStations.length > 0) setStationId(airStations[0].id);
  }, [airStations, stationId]);

  const latestQ = useFetch(() => airService.getLatest(stationId), [stationId]);
  const seriesQ = useFetch(() => airService.getSeries(stationId, hours), [stationId, hours]);

  const latest = latestQ.data;
  const series = seriesQ.data || [];
  const loading = !stationId || latestQ.loading || seriesQ.loading;
  const error = latestQ.error || seriesQ.error;

  const pollutantCards = useMemo(() => {
    if (!latest) return [];
    return Object.keys(POLLUTANTS).map((key) => {
      const value = latest[key];
      const si = subIndex(key, value);
      const category = si != null ? getAQICategory(si) : null;
      return { key, value, si, category, meta: POLLUTANTS[key] };
    });
  }, [latest]);

  const barData = pollutantCards.map((p) => ({ name: p.meta.label, value: p.si ?? 0, color: p.category?.color || '#94a3b8' }));

  const tableRows = useMemo(() => {
    if (series.length === 0) return [];
    const step = Math.max(1, Math.ceil(series.length / 12));
    return series.filter((_, i) => (series.length - 1 - i) % step === 0).slice(0, 12).reverse();
  }, [series]);

  if (!stations.length && !error) return <Spinner label="Loading stations…" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Air Quality</h2>
          <p className="page-sub">PM2.5, PM10, NO₂ and SO₂ readings with the computed Air Quality Index.</p>
        </div>
        <div className="page-actions">
          <select className="select select-inline" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            {airStations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="chip-row">
            {RANGES.map((r) => (
              <button key={r.hours} type="button" className={`chip${hours === r.hours ? ' active' : ''}`} onClick={() => setHours(r.hours)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <EmptyState icon="alert" title="Could not load air data" message={error} />}
      {loading && <Spinner label="Loading readings…" />}

      {!loading && !error && latest && (
        <>
          <div className={`banner banner-${getAQICategory(latest.aqi).label === 'Good' || getAQICategory(latest.aqi).label === 'Satisfactory' ? 'success' : 'warn'} mb-16`}>
            <Icon name={getAQICategory(latest.aqi).label === 'Good' ? 'check' : 'alert'} size={18} />
            <div>
              <strong>{getAQICategory(latest.aqi).label} air quality</strong> — {latest.advice}
            </div>
          </div>

          {/* Gauge + pollutant cards */}
          <div className="aqi-grid">
            <Card title="Air Quality Index" subtitle={`${latest.dominant ? `Dominant pollutant: ${POLLUTANTS[latest.dominant]?.label}` : ''}`}>
              <Gauge value={latest.aqi} max={500} zones={aqiZones()} label="AQI" category={latest.category} color={latest.color} />
              <p className="muted text-center mt-10">Updated {formatDateTime(latest.recordedAt)} ({timeAgo(latest.recordedAt)})</p>
            </Card>
            <div className="param-cards">
              {pollutantCards.map((p) => (
                <div key={p.key} className="card param-card">
                  <div className="param-head">
                    <span className="param-name">{p.meta.label}</span>
                    {p.category && <span className="index-pill" style={{ background: `${p.category.color}18`, color: p.category.color }}>SI {p.si}</span>}
                  </div>
                  <p className="param-value">{p.value} <small>{p.meta.unit}</small></p>
                  <p className="param-note muted">24h standard: {p.meta.limit} {p.meta.unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trend + sub-index breakdown */}
          <div className="dash-grid mt-20">
            <Card title={`Pollutant trend — last ${hours === 24 ? '24 hours' : hours === 72 ? '3 days' : '7 days'}`}>
              <TrendChart
                data={series}
                lines={Object.keys(POLLUTANTS).map((k) => ({ key: k, name: POLLUTANTS[k].label, color: LINE_COLORS[k] }))}
                height={280}
              />
            </Card>
            <Card title="Current sub-indices" subtitle="0–500 scale, worst pollutant defines the AQI">
              <ParamBarChart data={barData} height={280} />
            </Card>
          </div>

          {/* Recent readings */}
          <Card title="Recent readings" className="mt-20">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>PM2.5</th>
                    <th>PM10</th>
                    <th>NO₂</th>
                    <th>SO₂</th>
                    <th>AQI</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => {
                    const cat = getAQICategory(r.aqi);
                    return (
                      <tr key={r.id}>
                        <td className="muted">{formatDateTime(r.recordedAt)}</td>
                        <td>{r.pm25}</td>
                        <td>{r.pm10}</td>
                        <td>{r.no2}</td>
                        <td>{r.so2}</td>
                        <td>
                          <span className="index-pill" style={{ background: `${cat.color}18`, color: cat.color }}>{r.aqi}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="AQI scale reference" className="mt-20">
            <div className="scale-row">
              {AQI_SCALE.map((z) => (
                <div key={z.label} className="scale-cell" style={{ borderColor: z.color }}>
                  <span className="scale-dot" style={{ background: z.color }} />
                  <strong>{z.label}</strong>
                  <span className="muted">{z.min}–{z.max}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!loading && !error && !latest && (
        <Card><EmptyState title="No air data" message="This station has not reported any air readings yet." /></Card>
      )}
    </>
  );
}
