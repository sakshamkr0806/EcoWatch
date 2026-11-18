import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import useFetch from '../hooks/useFetch';
import { airService } from '../services/air.service';
import { waterService } from '../services/water.service';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Badge, { statusVariant, typeVariant } from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import TrendChart from '../components/charts/TrendChart';
import DonutChart from '../components/charts/DonutChart';
import MapPanel from '../components/maps/MapPanel';
import Icon from '../components/common/Icons';
import { getAQICategory } from '../utils/aqi';
import { getWQICategory } from '../utils/wqi';
import { timeAgo, round } from '../utils/format';

const SEVERITY_COLORS = { LOW: '#94a3b8', MODERATE: '#d97706', HIGH: '#dc2626', CRITICAL: '#7f1d1d' };

export default function Dashboard() {
  const { user } = useAuth();
  const { stations, alerts, loading: dataLoading, error: dataError } = useData();
  const airQ = useFetch(() => airService.getCitySummary(), []);
  const waterQ = useFetch(() => waterService.getCitySummary(), []);

  const loading = dataLoading || airQ.loading || waterQ.loading;
  const error = dataError || airQ.error || waterQ.error;

  const view = useMemo(() => {
    if (!airQ.data || !waterQ.data) return null;
    const airEntries = airQ.data.byStation.filter((e) => e.latest);
    const waterEntries = waterQ.data.byStation.filter((e) => e.latest);
    const activeAir = airEntries.filter((e) => e.station.status !== 'INACTIVE');
    const activeWater = waterEntries.filter((e) => e.station.status !== 'INACTIVE');

    const cityAqi = activeAir.length ? round(activeAir.reduce((s, e) => s + e.latest.aqi, 0) / activeAir.length, 0) : null;
    const worst = activeAir.reduce((w, e) => (!w || e.latest.aqi > w.latest.aqi ? e : w), null);
    const cityWqi = activeWater.length ? round(activeWater.reduce((s, e) => s + e.latest.wqi, 0) / activeWater.length, 0) : null;

    const openAlerts = alerts.filter((a) => a.status !== 'RESOLVED');
    const criticalAlerts = openAlerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');

    const severityData = Object.entries(
      openAlerts.reduce((acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] || 0) + 1 }), {})
    ).map(([name, value]) => ({ name, value, color: SEVERITY_COLORS[name] || '#94a3b8' }));

    // Map markers: colour by the station's air AQI (water-only stations use WQI).
    const airByStation = Object.fromEntries(airEntries.map((e) => [e.station.id, e.latest]));
    const waterByStation = Object.fromEntries(waterEntries.map((e) => [e.station.id, e.latest]));
    const markers = stations.map((s) => {
      const air = airByStation[s.id];
      const water = waterByStation[s.id];
      if (air) {
        const cat = getAQICategory(air.aqi);
        return { ...s, color: s.status === 'ACTIVE' ? cat.color : '#94a3b8', label: `AQI ${air.aqi} (${cat.label})` };
      }
      if (water) {
        const cat = getWQICategory(water.wqi);
        return { ...s, color: s.status === 'ACTIVE' ? cat.color : '#94a3b8', label: `WQI ${water.wqi} (${cat.label})` };
      }
      return { ...s, color: '#94a3b8', label: 'No recent data' };
    });

    const airMap = airByStation;
    const waterMap = waterByStation;

    return { cityAqi, worst, cityWqi, openAlerts, criticalAlerts, severityData, markers, airMap, waterMap, activeAir };
  }, [airQ.data, waterQ.data, alerts, stations]);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <EmptyState icon="alert" title="Could not load the dashboard" message={error} />;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Hello, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="page-sub">Current environmental conditions across the monitoring network.</p>
        </div>
        <div className="page-actions">
          <Link to="/reports" className="btn btn-outline"><Icon name="file" size={16} /> Reports</Link>
          <Link to="/measurements" className="btn btn-primary"><Icon name="plus" size={16} /> Log measurement</Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-4">
        <StatCard
          icon="wind" tone={view.cityAqi ? (getAQICategory(view.cityAqi).color ? 'green' : 'green') : 'gray'}
          label="City AQI (average)"
          value={view.cityAqi ?? '—'}
          sub={`${view.activeAir.length} air stations reporting`}
        />
        <StatCard
          icon="alert" tone="red"
          label="Most polluted station"
          value={view.worst ? view.worst.station.code : '—'}
          sub={view.worst ? `${view.worst.station.name} · AQI ${view.worst.latest.aqi}` : 'No data'}
        />
        <StatCard
          icon="drop" tone="blue"
          label="City WQI (average)"
          value={view.cityWqi ?? '—'}
          sub={view.cityWqi ? getWQICategory(view.cityWqi).label : 'No water data'}
        />
        <StatCard
          icon="bell" tone="amber"
          label="Open alerts"
          value={view.openAlerts.length}
          sub={`${view.criticalAlerts.length} high/critical`}
        />
      </div>

      {/* Trends + alert mix */}
      <div className="dash-grid mt-20">
        <Card title="City AQI — last 24 hours" subtitle="Average across all reporting air stations">
          <TrendChart
            data={airQ.data.trend}
            lines={[{ key: 'value', name: 'Average AQI', color: '#15803d' }]}
            height={260}
          />
        </Card>
        <Card title="Open alerts by severity">
          <DonutChart data={view.severityData} height={260} />
        </Card>
      </div>

      {/* Map + latest alerts */}
      <div className="dash-grid mt-20">
        <Card title="Station network" subtitle="Marker colour shows the latest AQI / WQI category">
          <MapPanel
            stations={view.markers}
            selectedId={view.worst?.station.id}
            onSelect={() => {}}
          />
        </Card>
        <Card
          title="Latest alerts"
          actions={<Link to="/alerts" className="btn btn-ghost btn-sm">View all</Link>}
        >
          {view.openAlerts.length === 0 && <EmptyState icon="check" title="All clear" message="No active environmental alerts." />}
          <div className="alert-mini-list">
            {view.openAlerts.slice(0, 5).map((a) => (
              <div key={a.id} className="alert-mini" style={{ borderLeftColor: SEVERITY_COLORS[a.severity] }}>
                <Icon name={a.type === 'AIR' ? 'wind' : 'drop'} size={16} className={a.type === 'AIR' ? 'text-blue' : 'text-cyan'} />
                <div>
                  <p className="alert-mini-msg">{a.message}</p>
                  <p className="alert-mini-meta">{a.stationCode} · {timeAgo(a.createdAt)} · {a.severity}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Station table */}
      <Card title="Monitoring stations" subtitle="Latest index value for every station" className="mt-20">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Type</th>
                <th>Air (AQI)</th>
                <th>Water (WQI)</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => {
                const air = view.airMap[s.id];
                const water = view.waterMap[s.id];
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <span className="muted table-sub">{s.area}</span>
                    </td>
                    <td><Badge variant={typeVariant(s.type)}>{s.type}</Badge></td>
                    <td>
                      {air ? (
                        <span className="index-pill" style={{ background: `${air.color}18`, color: air.color }}>
                          {air.aqi} · {air.category}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {water ? (
                        <span className="index-pill" style={{ background: `${water.color}18`, color: water.color }}>
                          {water.wqi} · {water.category}
                        </span>
                      ) : '—'}
                    </td>
                    <td><Badge variant={statusVariant(s.status)}>{s.status}</Badge></td>
                    <td className="muted">{(air || water) && timeAgo((air || water).recordedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
