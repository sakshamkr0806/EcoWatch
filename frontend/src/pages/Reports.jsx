import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { reportService } from '../services/report.service';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import DonutChart from '../components/charts/DonutChart';
import Icon from '../components/common/Icons';
import { downloadCsv } from '../utils/csv';
import { getAQICategory } from '../utils/aqi';
import { getWQICategory } from '../utils/wqi';
import { formatDateTime } from '../utils/format';

const PERIODS = [
  { hours: 24, label: 'Last 24 hours' },
  { hours: 72, label: 'Last 3 days' },
  { hours: 168, label: 'Last 7 days' },
  { hours: 720, label: 'Last 30 days' },
];

const AQI_COLORS = { Good: '#16a34a', Satisfactory: '#65a30d', Moderate: '#d97706', Poor: '#dc2626', 'Very Poor': '#7c3aed', Severe: '#7f1d1d' };
const WQI_COLORS = { Excellent: '#0e7490', Good: '#16a34a', Medium: '#d97706', Poor: '#dc2626', 'Very Poor': '#7f1d1d' };
const FALLBACK_COLORS = ['#16a34a', '#65a30d', '#d97706', '#dc2626', '#7c3aed', '#7f1d1d', '#0e7490'];

export default function Reports() {
  const { stations } = useData();
  const [stationId, setStationId] = useState('ALL');
  const [hours, setHours] = useState(168);
  const [detailed, setDetailed] = useState(false);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await reportService.buildReport({ stationId, hours, detailed });
      setReport(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Build a report for the last 7 days on first load.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodLabel = PERIODS.find((p) => p.hours === hours)?.label || `${hours} hours`;

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Environmental Monitoring Report'],
      ['Station', report.stationName],
      ['Period', periodLabel],
      ['Generated', formatDateTime(report.generatedAt)],
      [],
    ];
    if (report.air) {
      rows.push(['Air quality'], ['Parameter', 'Unit', 'Min', 'Average', 'Max', 'Standard', 'Exceedances']);
      report.air.stats.forEach((s) => rows.push([s.label, s.unit, s.min, s.avg, s.max, `${s.limit} ${s.unit}`, s.exceedances]));
      rows.push(['AQI', '', report.air.aqi.min, report.air.aqi.avg, report.air.aqi.max, '500 scale', '']);
      rows.push([]);
    }
    if (report.water) {
      rows.push(['Water quality'], ['Parameter', 'Unit', 'Min', 'Average', 'Max', 'Ideal']);
      report.water.stats.forEach((s) => rows.push([s.label, s.unit, s.min, s.avg, s.max, s.ideal]));
      rows.push(['WQI', '', report.water.wqi.min, report.water.wqi.avg, report.water.wqi.max, '100 scale']);
      rows.push([]);
    }
    rows.push(['Alerts', report.alerts.length]);
    downloadCsv(`ems-report-${report.stationId}-${Date.now()}.csv`, rows);
  };

  const colorFor = (name) => {
    if (AQI_COLORS[name]) return AQI_COLORS[name];
    if (WQI_COLORS[name]) return WQI_COLORS[name];
    return FALLBACK_COLORS[name.length % FALLBACK_COLORS.length];
  };

  return (
    <>
      <div className="page-header no-print">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-sub">Summarise network data for a station or the whole region, then export it.</p>
        </div>
      </div>

      <Card title="Report settings" className="no-print">
        <div className="report-controls">
          <div className="form-field">
            <label className="label" htmlFor="rp-station">Station</label>
            <select id="rp-station" className="select" value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="ALL">All stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="rp-period">Period</label>
            <select id="rp-period" className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {PERIODS.map((p) => (
                <option key={p.hours} value={p.hours}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="rp-detail">Detail</label>
            <select id="rp-detail" className="select" value={detailed ? 'yes' : 'no'} onChange={(e) => setDetailed(e.target.value === 'yes')}>
              <option value="no">Summary</option>
              <option value="yes">Detailed (with readings)</option>
            </select>
          </div>
          <div className="form-field form-field-btn">
            <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate report'}
            </button>
          </div>
        </div>
      </Card>

      {error && <EmptyState icon="alert" title="Could not build the report" message={error} />}
      {busy && !report && <Spinner label="Building report…" />}

      {report && (
        <div className="report-sheet mt-20">
          <div className="report-head">
            <div>
              <h2 className="page-title">Environmental Report — {report.stationName}</h2>
              <p className="page-sub">{periodLabel} · generated {formatDateTime(report.generatedAt)}</p>
            </div>
            <div className="report-export no-print">
              <button type="button" className="btn btn-outline" onClick={exportCsv}>
                <Icon name="download" size={15} /> CSV
              </button>
              <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                <Icon name="printer" size={15} /> Print / PDF
              </button>
            </div>
          </div>

          <div className="grid-4 mt-20">
            <StatCard icon="wind" tone="green" label="Average AQI" value={report.air ? report.air.aqi.avg : '—'} sub={report.air ? `${report.air.samples} air samples` : 'No air stations'} />
            <StatCard icon="alert" tone="red" label="Peak AQI" value={report.air ? report.air.aqi.max : '—'} sub={report.air ? getAQICategory(report.air.aqi.max).label : ''} />
            <StatCard icon="drop" tone="blue" label="Average WQI" value={report.water ? report.water.wqi.avg : '—'} sub={report.water ? `${report.water.samples} water samples` : 'No water stations'} />
            <StatCard icon="bell" tone="amber" label="Alerts in period" value={report.alerts.length} sub={`${report.alerts.filter((a) => a.status !== 'RESOLVED').length} still open`} />
          </div>

          {report.air && (
            <Card title="Air quality — pollutant statistics" className="mt-20">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th><th>Min</th><th>Average</th><th>Max</th><th>24h standard</th><th>Exceedances</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.air.stats.map((s) => (
                      <tr key={s.key}>
                        <td><strong>{s.label}</strong></td>
                        <td>{s.min}</td>
                        <td>{s.avg}</td>
                        <td>{s.max}</td>
                        <td className="muted">{s.limit} {s.unit}</td>
                        <td className={s.exceedances > 0 ? 'text-red' : 'text-green'}>{s.exceedances}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-16">
                <p className="card-sub">AQI category distribution ({report.air.samples} readings)</p>
                <DonutChart data={report.air.categories.map((c) => ({ ...c, color: colorFor(c.name) }))} height={230} />
              </div>
            </Card>
          )}

          {report.water && (
            <Card title="Water quality — parameter statistics" className="mt-20">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th><th>Min</th><th>Average</th><th>Max</th><th>Ideal range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.water.stats.map((s) => (
                      <tr key={s.key}>
                        <td><strong>{s.label}</strong></td>
                        <td>{s.min}</td>
                        <td>{s.avg}</td>
                        <td>{s.max}</td>
                        <td className="muted">{s.ideal} {s.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-16">
                <p className="card-sub">WQI category distribution ({report.water.samples} readings)</p>
                <DonutChart data={report.water.categories.map((c) => ({ ...c, color: colorFor(c.name) }))} height={230} />
              </div>
            </Card>
          )}

          {report.alerts.length > 0 && (
            <Card title={`Alerts during the period (${report.alerts.length})`} className="mt-20">
              <ul className="report-alert-list">
                {report.alerts.map((a) => (
                  <li key={a.id}>
                    <Icon name={a.type === 'AIR' ? 'wind' : 'drop'} size={14} />
                    <span>{a.message}</span>
                    <span className="muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detailed && report.readings && report.readings.length > 0 && (
            <Card title="Detailed readings (sampled)" className="mt-20">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th><th>Type</th><th>Readings</th><th>Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.readings.map((r) => (
                      <tr key={r.id}>
                        <td className="muted">{formatDateTime(r.recordedAt)}</td>
                        <td>{r.kind}</td>
                        <td>
                          {r.kind === 'AIR'
                            ? `PM2.5 ${r.pm25} · PM10 ${r.pm10} · NO₂ ${r.no2} · SO₂ ${r.so2}`
                            : `pH ${r.ph} · DO ${r.do} · Turb ${r.turbidity} · TDS ${r.tds}`}
                        </td>
                        <td><strong>{r.kind === 'AIR' ? r.aqi : r.wqi}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="disclaimer muted">
            Indices are calculated from sensor data using simplified CPCB-style breakpoints and a weighted WQI
            method. This report supports situational awareness only and does not replace laboratory analysis or
            official environmental advice.
          </p>
        </div>
      )}
    </>
  );
}
