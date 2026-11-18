// Monitoring stations service.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const stationService = {
  getStations() {
    if (USE_MOCKS) return mock.getStations();
    // Backend: GET /api/stations
    return request('/stations');
  },

  getStation(id) {
    if (USE_MOCKS) {
      return mock.getStations().then((list) => list.find((s) => s.id === id) || null);
    }
    // Backend: GET /api/stations/:id
    return request(`/stations/${id}`);
  },

  addStation(payload) {
    if (USE_MOCKS) return mock.addStation(payload);
    // Backend: POST /api/stations
    return request('/stations', { method: 'POST', body: payload });
  },
};
