// Operator-submitted measurements + the recent measurement log.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const measurementService = {
  getRecent(limit = 15) {
    if (USE_MOCKS) return mock.getRecentMeasurements(limit);
    // Backend: GET /api/measurements/recent?limit=...
    return request(`/measurements/recent?limit=${limit}`);
  },

  submit(payload) {
    if (USE_MOCKS) return mock.addMeasurement(payload);
    // Backend: POST /api/measurements  (validated by Member 2's middleware)
    return request('/measurements', { method: 'POST', body: payload });
  },
};
