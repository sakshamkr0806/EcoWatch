import Icon from './Icons';

// KPI card used on the dashboard and reports.
export default function StatCard({ icon, label, value, sub, tone = 'green' }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon name={icon} size={22} />
      </div>
      <div className="stat-text">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
      </div>
    </div>
  );
}
