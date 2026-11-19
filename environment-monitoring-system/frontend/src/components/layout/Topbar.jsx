import { useLocation } from 'react-router-dom';
import Icon from '../common/Icons';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';

const TITLES = {
  '/': 'Environmental Dashboard',
  '/stations': 'Monitoring Stations',
  '/air-quality': 'Air Quality',
  '/water-quality': 'Water Quality',
  '/measurements': 'Measurements',
  '/alerts': 'Environmental Alerts',
  '/reports': 'Reports',
};

export default function Topbar({ onMenu }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" size={20} />
      </button>
      <div>
        <h1 className="topbar-title">{TITLES[pathname] || 'EnvMonitor'}</h1>
        <p className="topbar-date">{today}</p>
      </div>
      <div className="topbar-right">
        <span className="avatar avatar-light">{initials(user?.name || 'U')}</span>
      </div>
    </header>
  );
}
