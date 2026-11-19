import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { stationService } from '../services/station.service';
import { alertService } from '../services/alert.service';

// Shared application data: the station list and the alert feed.
// Pages read from here instead of refetching stations on every screen.
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [stations, setStations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stationList, alertList] = await Promise.all([
        stationService.getStations(),
        alertService.getAlerts(),
      ]);
      setStations(stationList);
      setAlerts(alertList);
    } catch (err) {
      setError(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateAlertStatus = async (id, status) => {
    await alertService.updateStatus(id, status);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const addStation = async (payload) => {
    const created = await stationService.addStation(payload);
    await refresh();
    return created;
  };

  const stationById = (id) => stations.find((s) => s.id === id) || null;

  return (
    <DataContext.Provider
      value={{ stations, alerts, loading, error, refresh, updateAlertStatus, addStation, stationById }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
