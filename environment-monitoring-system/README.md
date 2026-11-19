# Environmental Monitoring System — Air & Water Quality

Full-stack web application that collects air and water quality measurements from
monitoring stations, computes the **Air Quality Index (AQI)** and **Water Quality
Index (WQI)**, and presents them through an interactive dashboard with historical
trends, an interactive map, threshold alerts and exportable reports.

## Repository layout (team roles)

```
environment-monitoring-system/
├── frontend/     # MEMBER 3 — React dashboard (implemented here)
│   └── ...       # see frontend/README.md for details
├── backend/      # MEMBER 2 — Express REST API, auth, AQI/WQI engine, alerts
├── backend/prisma/  # MEMBER 1 — schema, migrations, seeds
└── docs/         # all members — architecture, API and UI docs
```

## Quick start (frontend)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The frontend currently runs on a built-in mock dataset (30 days of hourly readings,
derived alerts, demo accounts) so it can be demonstrated before the backend exists.
Switch to the real API by setting `VITE_USE_MOCKS=false` in `frontend/.env`.

Demo accounts: `admin@ems.io / admin123` · `operator@ems.io / operator123` · `viewer@ems.io / viewer123`

## Feature summary

- Centralised station registry (air / water / combined stations)
- Live AQI (simplified CPCB method) and WQI (weighted method) indices with categories
- Historical trend charts (24 h / 3 d / 7 d), sub-index breakdowns, reading tables
- Interactive station map, threshold alerts with acknowledge/resolve workflow
- Operator measurement entry with validation, CSV + print/PDF reporting
- Role-based access: Admin, Operator, Viewer

## Documentation

- `docs/frontend/UI_structure.md` — pages, components, expected API endpoints
- `docs/architecture/` — to be added by the team (project overview, system architecture)
- `docs/api/` — to be added by Member 2
- `docs/database/` — to be added by Member 1

> This system supports environmental awareness and decision-making. It does not
> replace laboratory analysis or official environmental advice; output quality
> depends on the input measurements and the chosen index calculation methods.
