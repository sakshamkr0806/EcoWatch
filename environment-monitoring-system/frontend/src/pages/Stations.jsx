import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Badge, { statusVariant, typeVariant } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StationForm from '../components/forms/StationForm';
import Icon from '../components/common/Icons';
import { formatDate } from '../utils/format';

export default function Stations() {
  const { stations, addStation, loading, error } = useData();
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [savedOk, setSavedOk] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.area || '').toLowerCase().includes(q);
      const matchType = typeFilter === 'ALL' || s.type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchQ && matchType && matchStatus;
    });
  }, [stations, search, typeFilter, statusFilter]);

  const save = async (payload) => {
    setSaving(true);
    setServerError('');
    try {
      const created = await addStation(payload);
      setModalOpen(false);
      setSavedOk(`Station "${created.name}" was added to the network.`);
      setTimeout(() => setSavedOk(''), 5000);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Monitoring Stations</h2>
          <p className="page-sub">{stations.length} stations in the network · {filtered.length} shown</p>
        </div>
        {hasRole('ADMIN') && (
          <button type="button" className="btn btn-primary" onClick={() => { setServerError(''); setModalOpen(true); }}>
            <Icon name="plus" size={16} /> Add station
          </button>
        )}
      </div>

      {savedOk && <div className="banner banner-success mb-16">{savedOk}</div>}
      {error && <div className="banner banner-error mb-16">{error}</div>}

      <div className="filters">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder="Search name, code or area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select select-inline" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">All types</option>
          <option value="AIR">Air</option>
          <option value="WATER">Water</option>
          <option value="BOTH">Air + Water</option>
        </select>
        <select className="select select-inline" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {loading ? (
        <Card><EmptyState icon="clock" title="Loading stations…" /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="No stations match your filters" message="Try clearing the search or filters." /></Card>
      ) : (
        <div className="station-grid">
          {filtered.map((s) => (
            <div key={s.id} className="card station-card">
              <div className="station-card-head">
                <div>
                  <span className="station-code">{s.code}</span>
                  <h3>{s.name}</h3>
                  <p className="muted">{s.area || '—'}</p>
                </div>
                <div className="station-badges">
                  <Badge variant={typeVariant(s.type)}>{s.type}</Badge>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                </div>
              </div>
              <p className="station-desc">{s.description}</p>
              <p className="station-meta muted">
                {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)} · installed {formatDate(s.installedAt)}
              </p>
              <div className="station-actions">
                {(s.type === 'AIR' || s.type === 'BOTH') && (
                  <Link to="/air-quality" className="btn btn-outline btn-sm"><Icon name="wind" size={14} /> Air</Link>
                )}
                {(s.type === 'WATER' || s.type === 'BOTH') && (
                  <Link to="/water-quality" className="btn btn-outline btn-sm"><Icon name="drop" size={14} /> Water</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title="Add monitoring station" onClose={() => setModalOpen(false)}>
        <StationForm onSaved={save} onCancel={() => setModalOpen(false)} saving={saving} serverError={serverError} />
      </Modal>
    </>
  );
}
