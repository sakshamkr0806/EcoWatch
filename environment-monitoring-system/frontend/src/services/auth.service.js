// Authentication service: mock now, real endpoints wired and ready.
import { request, USE_MOCKS } from './api';
import { mock } from './mockData';

export const authService = {
  login(email, password) {
    if (USE_MOCKS) return mock.login(email, password);
    // Backend: POST /api/auth/login -> { user, token }
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },

  register(payload) {
    if (USE_MOCKS) return mock.register(payload);
    // Backend: POST /api/auth/register -> { user, token }
    return request('/auth/register', { method: 'POST', body: payload });
  },
};
