import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import Card from '../components/common/Card';
import Badge, { severityVariant, statusVariant } from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import Icon from '../components/common/Icons';
import { timeAgo, formatDateTime } from '../utils/format';

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
const SEVERITY_COLORS = { LOW: '#94a3b8', MODERATE: '#d97706', HIGH: '#dc2626', CRITICAL: '#7f1d1d' };

export default function Alerts() {
  const { alerts, updateAlertStatus, loading } = useData();
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [busyId, setBusyId] = useState(null);

  const counts = useMemo(() => {
    const open = alerts.filter((a) => a.status === 'OPEN');
    return {
      total: alerts.length,
      open: open.length,
      acknowledged: alerts.filter((a) => a.status === 'ACKNOWLEDGED').length,
      resolved: alerts.filter((a) => a.status === 'RESOLVED').length,
      critical: open.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length,
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => (severity === 'ALL' || a.severity === severity) && (status === 'ALL' || a.status === status))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  }, [alerts, severity, status]);

  const change = async (id, next) => {
    setBusyId(id);
    try {
      await updateAlertStatus(id, next);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Environmental Alerts</h2>
          <p className="page-sub">Threshold breaches detected by the monitoring network.</p>
        </div>
      </div>

      <div className="grid-4">
        <div className="card summary-tile"><span className="summary-num">{counts.open}</span><span className="summary-label">Open</span></div>
        <div className="card summary-tile"><span className="summary-num text-red">{counts.critical}</span><span className="summary-label">High / critical</span></div>
        <div className="card summary-tile"><span className="summary-num text-amber">{counts.acknowledged}</span><span className="summary-label">Acknowledged</span></div>
        <div className="card summary-tile"><span className="summary-num text-green">{counts.resolved}</span><span className="summary-label">Resolved</span></div>
      </div>

      <div className="filters mt-20">
        <select className="select select-inline" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="ALL">All severities</option>
          {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select select-inline" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {loading ? (
        <Card><EmptyState icon="clock" title="Loading alerts…" /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon="check" title="No alerts found" message="Nothing matches the current filters — that is usually good news." /></Card>
      ) : (
        <div className="alert-list">
          {filtered.map((a) => (
            <div key={a.id} className="card alert-card" style={{ borderLeft: `4px solid ${SEVERITY_COLORS[a.severity]}` }}>
              <div className={`alert-icon ${a.type === 'AIR' ? 'tile-blue' : 'tile-cyan'}`}>
                <Icon name={a.type === 'AIR' ? 'wind' : 'drop'} size={20} />
              </div>
              <div className="alert-body">
                <div className="alert-top">
                  <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                  <Badge variant={typeVariantSafe(a.type)}>{a.type === 'AIR' ? 'Air quality' : 'Water quality'}</Badge>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                </div>
                <p className="alert-message">{a.message}</p>
                <p className="alert-meta muted">
                  {a.stationName} ({a.stationCode}) · triggered {formatDateTime(a.createdAt)} ({timeAgo(a.createdAt)})
                  {a.threshold != null && ` · threshold ${a.threshold}`}
                </p>
              </div>
              <div className="alert-actions">
                {a.status === 'OPEN' && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busyId === a.id} onClick={() => change(a.id, 'ACKNOWLEDGED')}>
                    <Icon name="check" size={14} /> Acknowledge
                  </button>
                )}
                {a.status !== 'RESOLVED' && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busyId === a.id} onClick={() => change(a.id, 'RESOLVED')}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function typeVariantSafe(type) {
  return type === 'AIR' ? 'blue' : 'cyan';
}
