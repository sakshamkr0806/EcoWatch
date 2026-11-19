import { NavLink } from 'react-router-dom';
import Icon from '../common/Icons';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/stations', label: 'Stations', icon: 'pin' },
  { to: '/air-quality', label: 'Air Quality', icon: 'wind' },
  { to: '/water-quality', label: 'Water Quality', icon: 'drop' },
  { to: '/measurements', label: 'Measurements', icon: 'activity' },
  { to: '/alerts', label: 'Alerts', icon: 'bell' },
  { to: '/reports', label: 'Reports', icon: 'file' },
];

export default function Sidebar({ open, onClose }) {
  const { alerts } = useData();
  const { user, logout } = useAuth();
  const openAlerts = alerts.filter((a) => a.status !== 'RESOLVED').length;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">
          <Icon name="drop" size={18} />
        </span>
        <span>
          <strong>EcoWatch</strong>
          <small>Air &amp; Water Quality</small>
        </span>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
          <Icon name="x" size={18} />
        </button>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.to === '/alerts' && openAlerts > 0 && <span className="nav-count">{openAlerts}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="avatar">{initials(user?.name || 'U')}</span>
          <span className="user-meta">
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
          <Icon name="logout" size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}
