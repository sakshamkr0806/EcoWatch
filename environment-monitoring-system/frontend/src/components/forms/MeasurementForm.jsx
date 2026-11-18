import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { measurementService } from '../../services/measurement.service';
import { PARAM_LIMITS, paramsForStationType, validateValue } from '../../utils/validate';
import { toInputDateTime, formatDateTime } from '../../utils/format';

// Operator form for manually entering a measurement.
export default function MeasurementForm({ onSubmitted }) {
  const { stations } = useData();
  const [form, setForm] = useState({
    stationId: '',
    parameter: '',
    value: '',
    recordedAt: toInputDateTime(new Date()),
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const station = stations.find((s) => s.id === form.stationId) || null;
  const paramMeta = PARAM_LIMITS[form.parameter];

  const setStation = (e) => {
    const id = e.target.value;
    const next = stations.find((s) => s.id === id);
    setForm((f) => ({ ...f, stationId: id, parameter: '' }));
    setErrors({});
    setSuccess('');
    if (next?.type === 'AIR') setForm((f) => ({ ...f, parameter: 'pm25' }));
    if (next?.type === 'WATER') setForm((f) => ({ ...f, parameter: 'ph' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSuccess('');
    const next = {};
    if (!form.stationId) next.stationId = 'Select a station.';
    if (!form.parameter) next.parameter = 'Select a parameter.';
    const valueError = validateValue(form.parameter, form.value);
    if (valueError) next.value = valueError;
    if (!form.recordedAt) next.recordedAt = 'Recording time is required.';
    else if (new Date(form.recordedAt).getTime() > Date.now() + 60000) next.recordedAt = 'Time cannot be in the future.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const saved = await measurementService.submit({
        stationId: form.stationId,
        stationName: station?.name,
        parameter: form.parameter,
        value: form.value,
        recordedAt: new Date(form.recordedAt).toISOString(),
      });
      setSuccess(`Measurement logged: ${PARAM_LIMITS[saved.parameter].label} = ${saved.value} ${saved.unit} at ${station?.name}.`);
      setForm((f) => ({ ...f, value: '', recordedAt: toInputDateTime(new Date()) }));
      onSubmitted?.(saved);
    } catch (err) {
      setErrors({ value: err.message });
    } finally {
      setBusy(false);
    }
  };

  const options = station ? paramsForStationType(station.type) : [];
  const airOptions = options.filter((k) => PARAM_LIMITS[k].type === 'AIR');
  const waterOptions = options.filter((k) => PARAM_LIMITS[k].type === 'WATER');

  return (
    <form onSubmit={submit} noValidate>
      {success && <div className="banner banner-success mb-14">{success}</div>}

      <div className="form-field">
        <label className="label" htmlFor="ms-station">Station *</label>
        <select id="ms-station" className="select" value={form.stationId} onChange={setStation}>
          <option value="">Select a station…</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.type})
            </option>
          ))}
        </select>
        {errors.stationId && <p className="field-error">{errors.stationId}</p>}
      </div>

      <div className="form-field mt-14">
        <label className="label" htmlFor="ms-param">Parameter *</label>
        <select id="ms-param" className="select" value={form.parameter} onChange={(e) => { setForm((f) => ({ ...f, parameter: e.target.value })); setErrors({}); }}>
          <option value="">Select a parameter…</option>
          {airOptions.length > 0 && waterOptions.length > 0 && (
            <optgroup label="Air quality">
              {airOptions.map((k) => (
                <option key={k} value={k}>{PARAM_LIMITS[k].label} ({PARAM_LIMITS[k].unit})</option>
              ))}
            </optgroup>
          )}
          {airOptions.length > 0 && waterOptions.length > 0 && (
            <optgroup label="Water quality">
              {waterOptions.map((k) => (
                <option key={k} value={k}>{PARAM_LIMITS[k].label} ({PARAM_LIMITS[k].unit})</option>
              ))}
            </optgroup>
          )}
          {!(airOptions.length > 0 && waterOptions.length > 0) &&
            options.map((k) => (
              <option key={k} value={k}>{PARAM_LIMITS[k].label} ({PARAM_LIMITS[k].unit})</option>
            ))}
        </select>
        {errors.parameter && <p className="field-error">{errors.parameter}</p>}
      </div>

      <div className="form-grid mt-14">
        <div className="form-field">
          <label className="label" htmlFor="ms-value">
            Value {paramMeta ? `(${paramMeta.unit})` : ''} *
          </label>
          <input
            id="ms-value"
            className="input"
            type="number"
            step="any"
            value={form.value}
            onChange={(e) => { setForm((f) => ({ ...f, value: e.target.value })); setErrors({}); }}
            placeholder={paramMeta ? `Allowed ${paramMeta.min} – ${paramMeta.max}` : '0'}
          />
          {errors.value && <p className="field-error">{errors.value}</p>}
        </div>
        <div className="form-field">
          <label className="label" htmlFor="ms-time">Recorded at *</label>
          <input
            id="ms-time"
            className="input"
            type="datetime-local"
            value={form.recordedAt}
            onChange={(e) => { setForm((f) => ({ ...f, recordedAt: e.target.value })); setErrors({}); }}
          />
          {errors.recordedAt && <p className="field-error">{errors.recordedAt}</p>}
        </div>
      </div>

      <p className="hint">Readings are range-checked instantly; the backend re-validates on save.</p>

      <div className="modal-foot">
        <span className="muted">{form.recordedAt ? formatDateTime(new Date(form.recordedAt).toISOString()) : ''}</span>
        <button type="submit" className="btn btn-primary" disabled={busy || !stations.length}>
          {busy ? 'Saving…' : 'Log measurement'}
        </button>
      </div>
    </form>
  );
}
