import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import useFetch from '../hooks/useFetch';
import { waterService } from '../services/water.service';
import Card from '../components/common/Card';
import Gauge from '../components/common/Gauge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Icon from '../components/common/Icons';
import TrendChart from '../components/charts/TrendChart';
import ParamBarChart from '../components/charts/ParamBarChart';
import { WATER_PARAMS, WQI_SCALE, getWQICategory, scorePh, scoreDo, scoreTurbidity, scoreTds, wqiZones } from '../utils/wqi';
import { formatDateTime, timeAgo } from '../utils/format';

const LINE_COLORS = { ph: '#0ea5e9', do: '#16a34a', turbidity: '#d97706', tds: '#7c3aed' };
const RANGES = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

// Parameter key -> scoring function (0-100 quality rating).
const SCORERS = { ph: scorePh, do: scoreDo, turbidity: scoreTurbidity, tds: scoreTds };

export default function WaterQuality() {
  const { stations } = useData();
  const waterStations = stations.filter((s) => (s.type === 'WATER' || s.type === 'BOTH') && s.status !== 'INACTIVE');

  const [stationId, setStationId] = useState('');
  const [hours, setHours] = useState(24);

  useEffect(() => {
    if (!stationId && waterStations.length > 0) setStationId(waterStations[0].id);
  }, [waterStations, stationId]);

  const latestQ = useFetch(() => waterService.getLatest(stationId), [stationId]);
  const seriesQ = useFetch(() => waterService.getSeries(stationId, hours), [stationId, hours]);

  const latest = latestQ.data;
  const series = seriesQ.data || [];
  const loading = !stationId || latestQ.loading || seriesQ.loading;
  const error = latestQ.error || seriesQ.error;

  const paramCards = useMemo(() => {
    if (!latest) return [];
    return Object.keys(WATER_PARAMS).map((key) => {
      const value = latest[key];
      const score = SCORERS[key](value);
      const category = score != null ? getWQICategory(score) : null;
      return { key, value, score, category, meta: WATER_PARAMS[key] };
    });
  }, [latest]);

  // Bar chart shows each parameter's quality rating (higher = better).
  const barData = paramCards.map((p) => ({ name: p.meta.label, value: p.score ?? 0, color: p.category?.color || '#94a3b8' }));

  const tableRows = useMemo(() => {
    if (series.length === 0) return [];
    const step = Math.max(1, Math.ceil(series.length / 12));
    return series.filter((_, i) => (series.length - 1 - i) % step === 0).slice(0, 12).reverse();
  }, [series]);

  if (!stations.length && !error) return <Spinner label="Loading stations…" />;

  const category = latest ? getWQICategory(latest.wqi) : null;
  const goodWater = category && (category.label === 'Excellent' || category.label === 'Good');

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Water Quality</h2>
          <p className="page-sub">pH, dissolved oxygen, turbidity and TDS readings with the computed Water Quality Index.</p>
        </div>
        <div className="page-actions">
          <select className="select select-inline" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            {waterStations.map((s) => (
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

      {error && <EmptyState icon="alert" title="Could not load water data" message={error} />}
      {loading && <Spinner label="Loading readings…" />}

      {!loading && !error && latest && category && (
        <>
          <div className={`banner banner-${goodWater ? 'success' : 'warn'} mb-16`}>
            <Icon name={goodWater ? 'check' : 'alert'} size={18} />
            <div><strong>{category.label} water quality</strong> — {latest.advice}</div>
          </div>

          <div className="aqi-grid">
            <Card title="Water Quality Index" subtitle="Weighted score from pH, DO, turbidity and TDS">
              <Gauge value={latest.wqi} max={100} zones={wqiZones()} label="WQI" category={latest.category} color={latest.color} />
              <p className="muted text-center mt-10">Updated {formatDateTime(latest.recordedAt)} ({timeAgo(latest.recordedAt)})</p>
            </Card>
            <div className="param-cards">
              {paramCards.map((p) => (
                <div key={p.key} className="card param-card">
                  <div className="param-head">
                    <span className="param-name">{p.meta.label}</span>
                    {p.category && (
                      <span className="index-pill" style={{ background: `${p.category.color}18`, color: p.category.color }}>
                        {Math.round(p.score)}/100
                      </span>
                    )}
                  </div>
                  <p className="param-value">
                    {p.value} <small>{p.meta.unit}</small>
                  </p>
                  <p className="param-note muted">Ideal: {p.meta.ideal} · {p.meta.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-grid mt-20">
            <Card title={`Parameter trend — last ${hours === 24 ? '24 hours' : hours === 72 ? '3 days' : '7 days'}`}>
              <TrendChart
                data={series}
                lines={Object.keys(WATER_PARAMS).map((k) => ({ key: k, name: WATER_PARAMS[k].label, color: LINE_COLORS[k] }))}
                height={280}
              />
            </Card>
            <Card title="Current quality ratings" subtitle="0–100 per parameter (higher is better)">
              <ParamBarChart data={barData} height={280} />
            </Card>
          </div>

          <Card title="Recent readings" className="mt-20">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>pH</th>
                    <th>DO (mg/L)</th>
                    <th>Turbidity (NTU)</th>
                    <th>TDS (ppm)</th>
                    <th>WQI</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => {
                    const cat = getWQICategory(r.wqi);
                    return (
                      <tr key={r.id}>
                        <td className="muted">{formatDateTime(r.recordedAt)}</td>
                        <td>{r.ph}</td>
                        <td>{r.do}</td>
                        <td>{r.turbidity}</td>
                        <td>{r.tds}</td>
                        <td>
                          <span className="index-pill" style={{ background: `${cat.color}18`, color: cat.color }}>{r.wqi}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="WQI scale reference" className="mt-20">
            <div className="scale-row">
              {WQI_SCALE.map((z) => (
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
        <Card><EmptyState title="No water data" message="This station has not reported any water readings yet." /></Card>
      )}
    </>
  );
}
