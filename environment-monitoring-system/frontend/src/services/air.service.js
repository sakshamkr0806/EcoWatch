// Air quality data service.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const airService = {
  getStations() {
    if (USE_MOCKS) return mock.getAirStations();
    // Backend: GET /api/stations?type=AIR
    return request('/stations?type=AIR');
  },

  getLatest(stationId) {
    if (!stationId) return Promise.resolve(null);
    if (USE_MOCKS) return mock.getLatestAir(stationId);
    // Backend: GET /api/air/latest?stationId=...
    return request(`/air/latest?stationId=${stationId}`);
  },

  getSeries(stationId, hours) {
    if (!stationId) return Promise.resolve([]);
    if (USE_MOCKS) return mock.getAirSeries(stationId, hours);
    // Backend: GET /api/air/history?stationId=...&hours=...
    return request(`/air/history?stationId=${stationId}&hours=${hours}`);
  },

  getCitySummary() {
    if (USE_MOCKS) return mock.getAirCitySummary();
    // Backend: GET /api/air/summary
    return request('/air/summary');
  },
};
