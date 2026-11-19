# UI Structure

## Routes

| Route              | Page                  | Access     | Purpose                                                          |
| ------------------ | --------------------- | ---------- | ---------------------------------------------------------------- |
| `/login`           | Login.jsx             | public     | Sign in (demo accounts clickable)                                |
| `/register`        | Register.jsx          | public     | Create account (role: Admin / Operator / Viewer)                 |
| `/`                | Dashboard.jsx         | authed     | KPIs, 24h AQI/WQI trends, alert mix, station map, station table  |
| `/stations`        | Stations.jsx          | authed     | Searchable/filterable station cards; Admin can add stations      |
| `/air-quality`     | AirQuality.jsx        | authed     | AQI gauge, pollutant cards, trend chart, sub-index bars, table   |
| `/water-quality`   | WaterQuality.jsx      | authed     | WQI gauge, parameter cards, trend chart, ratings bars, table     |
| `/measurements`    | Measurements.jsx      | authed     | Operator measurement form with validation + recent feed          |
| `/alerts`          | Alerts.jsx            | authed     | Severity/status filters, acknowledge & resolve actions           |
| `/reports`         | Reports.jsx           | authed     | Summary/detailed reports, CSV export, print-to-PDF               |

Unauthenticated users are redirected to `/login` (`ProtectedRoute`).

## Key components

- `layout/` — sidebar (collapsible on mobile), topbar, route guard.
- `common/Gauge` — SVG semi-circular gauge used for both AQI (0–500) and WQI (0–100).
- `common/*` — Card, StatCard, Badge, Modal, Spinner, EmptyState, inline SVG icons.
- `charts/*` — Recharts wrappers: TrendChart (multi-series lines), ParamBarChart, DonutChart.
- `maps/MapPanel` — dependency-free SVG city map; stations positioned by lat/lng
  normalisation, marker colour = latest AQI/WQI category.
- `forms/*` — StationForm (admin), MeasurementForm (operator, client-side range validation).

## State & data flow

- `AuthContext` — session user + role helpers, persisted in localStorage.
- `DataContext` — station list + alert feed shared app-wide; alert status changes update in place.
- `useFetch` — small hook for loading page-scoped data with loading/error states.
- `services/*` — one module per domain. Mock backend (`mockData.js`) returns generated
  data today; the real REST calls are written out and activated via `VITE_USE_MOCKS=false`.

## Design system

Tokens in `styles/variables.css` (brand green + water blue, AQI/WQI category colours,
radius/shadow scale). Five stylesheets: variables, global (primitives), layout,
components, pages. Responsive breakpoints at 1100px / 960px / 640px; print styles
strip navigation for report printing.

## Expected backend endpoints

- `POST /api/auth/login`, `POST /api/auth/register`
- `GET /api/stations`, `GET /api/stations/:id`, `POST /api/stations`
- `GET /api/air/latest?stationId=`, `GET /api/air/history?stationId=&hours=`, `GET /api/air/summary`
- `GET /api/water/latest?stationId=`, `GET /api/water/history?stationId=&hours=`, `GET /api/water/summary`
- `GET /api/measurements/recent?limit=`, `POST /api/measurements`
- `GET /api/alerts`, `PATCH /api/alerts/:id/status`
- `POST /api/reports`

## Screenshots

Add demo screenshots to this folder (`docs/frontend/screenshots/`) for the report/viva:
dashboard, air-quality page with gauge, map panel, alerts page, generated report.
