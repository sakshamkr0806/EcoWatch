// Environmental alerts service.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const alertService = {
  getAlerts() {
    if (USE_MOCKS) return mock.getAlerts();
    // Backend: GET /api/alerts
    return request('/alerts');
  },

  updateStatus(id, status) {
    if (USE_MOCKS) return mock.updateAlertStatus(id, status);
    // Backend: PATCH /api/alerts/:id/status  { status: OPEN | ACKNOWLEDGED | RESOLVED }
    return request(`/alerts/${id}/status`, { method: 'PATCH', body: { status } });
  },
};
