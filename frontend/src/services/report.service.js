// Report building service.
// In mock mode the report is assembled in the browser from the generated
// dataset; with the real backend this maps to the reporting endpoints.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const reportService = {
  buildReport(params) {
    if (USE_MOCKS) return mock.buildReport(params);
    // Backend: POST /api/reports  { stationId, hours, detailed }
    return request('/reports', { method: 'POST', body: params });
  },
};
