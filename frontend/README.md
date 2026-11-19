# EnvMonitor — Frontend

React (JavaScript / JSX) frontend for the **Environmental Monitoring System for Air and Water Quality**.
Member 3's deliverable: dashboards, visualisations, maps, forms and frontend-backend integration.

## Tech stack

- **React 18** with plain **JSX** (no TypeScript)
- **Vite** dev server / bundler
- **React Router v6** — page routing
- **Recharts** — trend / bar / donut charts
- **Plain CSS** — no framework, tokens in `src/styles/variables.css`
- Zero-dependency **SVG map** (no Google Maps key, works offline)

## Quick start

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Demo accounts (click to auto-fill on the login screen):

| Role     | Email            | Password    | Can do                          |
| -------- | ---------------- | ----------- | ------------------------------- |
| Admin    | admin@ems.io     | admin123    | everything incl. add stations   |
| Operator | operator@ems.io  | operator123 | submit measurements             |
| Viewer   | viewer@ems.io    | viewer123   | read-only                       |

## Mock mode vs real backend

The app ships with a built-in mock backend (`src/services/mockData.js`) that generates
30 days of hourly sensor data, so the UI is fully demo-able before the Express + Prisma
API is finished. To connect to the real backend:

```bash
cp .env.example .env
# then edit .env:
#   VITE_API_URL=http://localhost:5000/api
#   VITE_USE_MOCKS=false
```

Every service in `src/services/` already contains the matching real API call in comments.
Expected endpoints are listed in `docs/frontend/UI_structure.md`.

## Project structure

```
src/
├── main.jsx              # entry: providers + styles + router
├── App.jsx               # routes
├── components/
│   ├── common/           # Card, StatCard, Badge, Gauge, Modal, Spinner, EmptyState, Icons
│   ├── charts/           # TrendChart, ParamBarChart, DonutChart (Recharts)
│   ├── maps/             # MapPanel (custom SVG city map)
│   ├── forms/            # StationForm, MeasurementForm
│   └── layout/           # Layout, Sidebar, Topbar, ProtectedRoute
├── pages/                # Login, Register, Dashboard, Stations, AirQuality,
│                         # WaterQuality, Measurements, Alerts, Reports, NotFound
├── context/              # AuthContext (session), DataContext (stations + alerts)
├── hooks/                # useFetch — tiny data-fetching hook
├── services/             # api client + one file per domain + mockData
├── utils/                # aqi.js, wqi.js (index maths), validate, format, csv
└── styles/               # variables, global, layout, components, pages
```

## Calculation notes (matches backend spec)

- **AQI** — simplified CPCB method: each pollutant (PM2.5, PM10, NO₂, SO₂) is converted
  to a 0–500 sub-index by linear interpolation between breakpoints; the worst sub-index
  is the AQI. See `src/utils/aqi.js`.
- **WQI** — weighted quality ratings for pH (0.2), DO (0.3), turbidity (0.25), TDS (0.25);
  weighted average gives 0–100. See `src/utils/wqi.js`.
- When the backend is connected, the API's calculated values are authoritative —
  the frontend helpers remain for display fallback and validation.
