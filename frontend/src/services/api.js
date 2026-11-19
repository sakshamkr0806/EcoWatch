// Central HTTP client for the backend REST API (Member 2's Express server).
//
// The frontend ships with a built-in mock backend so it is fully demo-able
// before the real API exists. Switch to the real API with:
//   1. copy .env.example -> .env
//   2. set VITE_USE_MOCKS=false and point VITE_API_URL at the backend
// Every service in src/services already has the real call written out.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Mocks are ON unless VITE_USE_MOCKS is explicitly "false".
export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

// Generic request helper. Throws an Error with a readable message on failure.
export async function request(path, { method = 'GET', body, ...rest } = {}) {
  const token = localStorage.getItem('ems_token');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }

  return res.status === 204 ? null : res.json();
}
