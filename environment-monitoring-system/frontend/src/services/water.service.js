// Water quality data service.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const waterService = {
  getStations() {
    if (USE_MOCKS) return mock.getWaterStations();
    // Backend: GET /api/stations?type=WATER
    return request('/stations?type=WATER');
  },

  getLatest(stationId) {
    if (!stationId) return Promise.resolve(null);
    if (USE_MOCKS) return mock.getLatestWater(stationId);
    // Backend: GET /api/water/latest?stationId=...
    return request(`/water/latest?stationId=${stationId}`);
  },

  getSeries(stationId, hours) {
    if (!stationId) return Promise.resolve([]);
    if (USE_MOCKS) return mock.getWaterSeries(stationId, hours);
    // Backend: GET /api/water/history?stationId=...&hours=...
    return request(`/water/history?stationId=${stationId}&hours=${hours}`);
  },

  getCitySummary() {
    if (USE_MOCKS) return mock.getWaterCitySummary();
    // Backend: GET /api/water/summary
    return request('/water/summary');
  },
};
