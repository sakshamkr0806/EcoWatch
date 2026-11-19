# EcoWatch

**Environmental monitoring for air and water quality** — a dashboard for tracking
sensor stations, AQI/WQI indices, threshold alerts and downloadable reports.

[![CI](https://github.com/sakshamkr0806/EcoWatch/actions/workflows/ci.yml/badge.svg)](https://github.com/sakshamkr0806/EcoWatch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **Dashboard** — KPIs, 24h AQI/WQI trends, alert mix, station map and station table
- **Air quality** — AQI gauge, pollutant cards (PM2.5, PM10, NO₂, SO₂), sub-index bars
- **Water quality** — WQI gauge, parameter cards (pH, DO, turbidity, TDS), rating bars
- **Stations** — searchable/filterable station cards with role-gated creation
- **Measurements** — operator entry form with client-side range validation
- **Alerts** — severity/status filters with acknowledge & resolve actions
- **Reports** — summary/detailed reports, CSV export, print-to-PDF
- **Role-based access** — Admin, Operator and Viewer permission levels

## Tech stack

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| UI       | React 18 (JSX)                                                    |
| Build    | [Vite](https://vitejs.dev)                                        |
| Routing  | React Router v6                                                   |
| Charts   | Recharts                                                          |
| Styling  | Plain CSS with design tokens (`src/styles/variables.css`)         |
| Map      | Zero-dependency inline SVG (no API key, works offline)            |

## Getting started

```bash
git clone https://github.com/sakshamkr0806/EcoWatch.git
cd EcoWatch/frontend
npm install
npm run dev          # http://localhost:3000
```

Demo accounts (click to auto-fill on the login screen):

| Role     | Email           | Password    | Permissions               |
| -------- | --------------- | ----------- | ------------------------- |
| Admin    | admin@ems.io    | admin123    | everything, incl. stations |
| Operator | operator@ems.io | operator123 | submit measurements       |
| Viewer   | viewer@ems.io   | viewer123   | read-only                 |

The app ships with a built-in mock backend, so it is fully demo-able with no server.
See [`frontend/README.md`](frontend/README.md) for mock vs. real-API configuration.

## Project structure

```
.
├── .github/workflows/    # CI: install → build on every push / PR
├── docs/                 # Design & API documentation
│   └── frontend/         #   routes, components, data flow
├── frontend/             # React application (Vite)
│   ├── public/           #   static assets
│   ├── src/
│   │   ├── components/   #   common · charts · forms · layout · maps
│   │   ├── pages/        #   one file per route
│   │   ├── context/      #   AuthContext, DataContext
│   │   ├── hooks/        #   useFetch
│   │   ├── services/     #   API client, one module per domain, mocks
│   │   ├── styles/       #   variables → global → layout → components → pages
│   │   └── utils/        #   aqi, wqi, validate, format, csv
│   ├── tests/            #   test suite (see README inside)
│   ├── index.html
│   └── vite.config.js
├── vercel.json           # Deployment config (SPA rewrites + build output)
├── LICENSE
└── README.md
```

## Documentation

- [`frontend/README.md`](frontend/README.md) — frontend setup, structure, calculation notes
- [`docs/frontend/UI_structure.md`](docs/frontend/UI_structure.md) — routes, components, data flow, design system

## Deployment

Hosted on **Vercel**. Build settings are committed to the repo so no dashboard
configuration is required:

- **Root directory** — `frontend`
- **Build command** — `npm run build`
- **Output directory** — `dist`
- **Rewrites** — SPA fallback (all routes → `index.html`), defined in `vercel.json`

Pushing to `main` triggers a deploy; every push and pull request also runs CI.

## Contributing

1. Fork and create a feature branch (`git checkout -b feature/amazing-change`)
2. Commit with a clear message (`git commit -m "Add amazing change"`)
3. Push and open a Pull Request

## License

Released under the [MIT License](LICENSE).
