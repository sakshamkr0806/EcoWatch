import { useState } from 'react';

// Admin form for registering a new monitoring station.
export default function StationForm({ onSaved, onCancel, saving, serverError }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'AIR',
    area: '',
    lat: '',
    lng: '',
    description: '',
  });
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Station name is required.';
    if (form.code && form.code.length > 5) next.code = 'Code must be 5 characters or fewer.';
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (form.lat === '' || Number.isNaN(lat) || lat < -90 || lat > 90) next.lat = 'Latitude must be between -90 and 90.';
    if (form.lng === '' || Number.isNaN(lng) || lng < -180 || lng > 180) next.lng = 'Longitude must be between -180 and 180.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (validate()) onSaved(form);
  };

  return (
    <form onSubmit={submit} noValidate>
      {serverError && <div className="banner banner-error mb-16">{serverError}</div>}

      <div className="form-grid">
        <div className="form-field">
          <label className="label" htmlFor="st-name">Station name *</label>
          <input id="st-name" className="input" value={form.name} onChange={set('name')} placeholder="e.g. Mayur Vihar Phase 3" />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div className="form-field">
          <label className="label" htmlFor="st-code">Short code</label>
          <input id="st-code" className="input" value={form.code} onChange={set('code')} placeholder="auto from name" maxLength={5} />
          {errors.code && <p className="field-error">{errors.code}</p>}
        </div>
        <div className="form-field">
          <label className="label" htmlFor="st-type">Monitors *</label>
          <select id="st-type" className="select" value={form.type} onChange={set('type')}>
            <option value="AIR">Air quality</option>
            <option value="WATER">Water quality</option>
            <option value="BOTH">Air + Water</option>
          </select>
        </div>
        <div className="form-field">
          <label className="label" htmlFor="st-area">Area / zone</label>
          <input id="st-area" className="input" value={form.area} onChange={set('area')} placeholder="e.g. East Delhi" />
        </div>
        <div className="form-field">
          <label className="label" htmlFor="st-lat">Latitude *</label>
          <input id="st-lat" className="input" type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="28.6469" />
          {errors.lat && <p className="field-error">{errors.lat}</p>}
        </div>
        <div className="form-field">
          <label className="label" htmlFor="st-lng">Longitude *</label>
          <input id="st-lng" className="input" type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="77.3162" />
          {errors.lng && <p className="field-error">{errors.lng}</p>}
        </div>
      </div>

      <div className="form-field mt-14">
        <label className="label" htmlFor="st-desc">Description</label>
        <textarea id="st-desc" className="input" rows={2} value={form.description} onChange={set('description')} placeholder="What does this station monitor?" />
      </div>

      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save station'}
        </button>
      </div>
    </form>
  );
}
