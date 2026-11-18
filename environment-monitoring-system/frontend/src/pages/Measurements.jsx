import { useEffect, useState } from 'react';
import Card from '../components/common/Card';
import Badge, { statusVariant } from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import MeasurementForm from '../components/forms/MeasurementForm';
import { measurementService } from '../services/measurement.service';
import { PARAM_LIMITS } from '../utils/validate';
import { formatDateTime } from '../utils/format';
import Icon from '../components/common/Icons';

export default function Measurements() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    measurementService
      .getRecent(15)
      .then(setRows)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const onSubmitted = (saved) => {
    setRows((prev) => {
      const list = prev || [];
      return [saved, ...list].slice(0, 15);
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Measurements</h2>
          <p className="page-sub">Submit a validated reading manually, or review the live sensor feed.</p>
        </div>
      </div>

      <div className="dash-grid measurements-grid">
        <Card title="Log a new measurement" subtitle="Authorised operators only — values are range-checked">
          <MeasurementForm onSubmitted={onSubmitted} />
        </Card>

        <Card
          title="Recent measurements"
          subtitle="Sensor stream + operator submissions"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
              <Icon name="clock" size={14} /> Refresh
            </button>
          }
        >
          {error && <EmptyState icon="alert" title="Could not load measurements" message={error} />}
          {!error && !rows && <EmptyState icon="clock" title="Loading measurements…" />}
          {!error && rows && rows.length === 0 && <EmptyState title="No measurements yet" />}
          {!error && rows && rows.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Station</th>
                    <th>Parameter</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="muted">{formatDateTime(m.recordedAt)}</td>
                      <td>{m.stationName}</td>
                      <td>{PARAM_LIMITS[m.parameter]?.label || m.parameter}</td>
                      <td>
                        <strong>{m.value}</strong> <span className="muted">{m.unit}</span>
                      </td>
                      <td>
                        <span className="source-pill">{m.source === 'OPERATOR' ? 'Operator' : 'Sensor'}</span>
                      </td>
                      <td><Badge variant={statusVariant(m.status)}>{m.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
