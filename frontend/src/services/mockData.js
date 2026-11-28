// In-memory "mock backend" so the frontend is fully demo-able before the
// real Express + Prisma API (Members 1 & 2) is finished. It generates
// 30 days of hourly sensor readings for every station, derives AQI/WQI with
// the same maths the backend will use, and persists user actions (added
// stations, submitted measurements, alert statuses, registered accounts)
// in localStorage. Every method returns a Promise with a small artificial
// delay so loading states behave like a real network.

import { computeAQI, getAQICategory, POLLUTANTS } from '../utils/aqi.js';
import { computeWQI, getWQICategory, WATER_PARAMS } from '../utils/wqi.js';
import { PARAM_LIMITS, validateValue } from '../utils/validate.js';
import { chartLabel, round } from '../utils/format.js';

const HOUR = 3600 * 1000;
const DAYS = 30;
const HOURS = DAYS * 24;

// ---------------------------------------------------------------------------
// Seeded pseudo-random generator (keeps generated data stable per session)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261118);

// Bell-curve helper for rush-hour effects.
const bell = (x, mean, sigma) => Math.exp(-((x - mean) ** 2) / (2 * sigma * sigma));

// Safe localStorage (never crashes during tests / SSR).
const store = {
  get(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full / unavailable */
    }
  },
};

const KEYS = {
  stations: 'ems_extra_stations',
  alerts: 'ems_alert_status',
  measurements: 'ems_measurements',
  users: 'ems_users',
};

const delay = (ms = 260) => new Promise((res) => setTimeout(res, ms + rand() * 220));

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
const BASE_STATIONS = [
  { id: 'ST-001', code: 'ANV', name: 'Anand Vihar', type: 'BOTH', area: 'East Delhi', lat: 28.6469, lng: 77.3162, status: 'ACTIVE', installedAt: '2023-04-12', description: 'Major traffic junction surrounded by industrial activity.' },
  { id: 'ST-002', code: 'DWK', name: 'Dwarka Sector 8', type: 'AIR', area: 'South West Delhi', lat: 28.5710, lng: 77.0719, status: 'ACTIVE', installedAt: '2023-06-02', description: 'Residential zone air quality reference point.' },
  { id: 'ST-003', code: 'ITO', name: 'Yamuna Ghat — ITO', type: 'WATER', area: 'Central Delhi', lat: 28.6285, lng: 77.2410, status: 'ACTIVE', installedAt: '2023-03-19', description: 'River water quality monitoring at the ITO barrage.' },
  { id: 'ST-004', code: 'RHN', name: 'Rohini Sector 16', type: 'AIR', area: 'North West Delhi', lat: 28.7390, lng: 77.0903, status: 'MAINTENANCE', installedAt: '2023-08-27', description: 'Sensors under calibration; data may drift.' },
  { id: 'ST-005', code: 'PLA', name: 'Palla Well Field', type: 'WATER', area: 'North Delhi', lat: 28.7760, lng: 77.1500, status: 'ACTIVE', installedAt: '2023-02-08', description: 'Groundwater intake point for the city supply.' },
  { id: 'ST-006', code: 'OKH', name: 'Okhla Phase 2', type: 'BOTH', area: 'South East Delhi', lat: 28.5494, lng: 77.2778, status: 'ACTIVE', installedAt: '2023-05-30', description: 'Industrial cluster with effluent discharge points.' },
  { id: 'ST-007', code: 'NRL', name: 'Narela Industrial Area', type: 'AIR', area: 'North Delhi', lat: 28.8225, lng: 77.0910, status: 'INACTIVE', installedAt: '2023-01-15', description: 'Offline since the network upgrade.' },
];

// Typical concentration levels per air station (µg/m³).
const AIR_BASE = {
  'ST-001': { pm25: 108, pm10: 205, no2: 58, so2: 22 },
  'ST-002': { pm25: 56, pm10: 118, no2: 33, so2: 11 },
  'ST-004': { pm25: 72, pm10: 148, no2: 40, so2: 15 },
  'ST-006': { pm25: 90, pm10: 176, no2: 52, so2: 29 },
  'ST-007': { pm25: 85, pm10: 160, no2: 47, so2: 19 },
};

// Typical levels per water station.
const WATER_BASE = {
  'ST-001': { ph: 7.4, do: 6.9, turbidity: 2.9, tds: 520 },
  'ST-003': { ph: 7.9, do: 4.1, turbidity: 6.4, tds: 940 },
  'ST-005': { ph: 7.2, do: 8.3, turbidity: 1.5, tds: 230 },
  'ST-006': { ph: 8.2, do: 5.3, turbidity: 4.5, tds: 760 },
};

// ---------------------------------------------------------------------------
// Reading generation (30 days of hourly points per station)
// ---------------------------------------------------------------------------
function generateAirData() {
  const flat = [];
  const byStation = new Map();
  const now = Date.now();

  Object.entries(AIR_BASE).forEach(([stationId, base]) => {
    const station = BASE_STATIONS.find((s) => s.id === stationId);
    // Inactive stations stopped reporting 26 hours ago.
    const stopHoursAgo = station.status === 'INACTIVE' ? 26 : 0;
    const series = [];
    const drift = { pm25: 0, pm10: 0, no2: 0, so2: 0 };

    for (let h = HOURS; h >= stopHoursAgo; h--) {
      const t = new Date(now - h * HOUR);
      const hour = t.getHours();
      const day = t.getDay();
      // Traffic peaks around 9 AM and 8:30 PM; calmer at night and on weekends.
      const rush = 1 + 0.22 * bell(hour, 9, 2.2) + 0.26 * bell(hour, 20.5, 2.4);
      const night = hour >= 23 || hour <= 5 ? 0.82 : 1;
      const weekend = day === 0 || day === 6 ? 0.9 : 1;

      const reading = { id: `AR-${stationId}-${h}`, stationId, recordedAt: t.toISOString() };
      Object.keys(base).forEach((key) => {
        drift[key] = drift[key] * 0.92 + (rand() - 0.5) * base[key] * 0.14;
        const value = Math.max(1, (base[key] + drift[key]) * rush * night * weekend);
        reading[key] = round(value, 1);
      });
      const { aqi, dominant } = computeAQI(reading);
      reading.aqi = aqi;
      reading.dominant = dominant;
      series.push(reading);
      flat.push(reading);
    }
    byStation.set(stationId, series);
  });

  return { flat, byStation };
}

function generateWaterData() {
  const flat = [];
  const byStation = new Map();
  const now = Date.now();

  Object.entries(WATER_BASE).forEach(([stationId, base]) => {
    const series = [];
    const drift = { ph: 0, do: 0, turbidity: 0, tds: 0 };

    for (let h = HOURS; h >= 0; h--) {
      const t = new Date(now - h * HOUR);
      const hour = t.getHours();
      const reading = { id: `WR-${stationId}-${h}`, stationId, recordedAt: t.toISOString() };

      // Oxygen dips overnight and peaks mid-afternoon (photosynthesis).
      const oxygenSwing = 0.5 * bell(hour, 15, 3) - 0.35 * bell(hour, 4, 3);
      // Occasional storm events spike turbidity, which then slowly decays.
      if (rand() < 0.015) drift.turbidity += 2.5 + rand() * 3;
      drift.turbidity *= 0.94;

      reading.ph = round(base.ph + (rand() - 0.5) * 0.25, 2);
      reading.do = round(Math.max(0.5, base.do + oxygenSwing + (rand() - 0.5) * 0.5), 2);
      reading.turbidity = round(Math.max(0.1, base.turbidity + drift.turbidity + (rand() - 0.5) * 0.6), 2);
      reading.tds = round(Math.max(20, base.tds + (rand() - 0.5) * 60), 0);

      const { wqi } = computeWQI(reading);
      reading.wqi = wqi;
      series.push(reading);
      flat.push(reading);
    }
    byStation.set(stationId, series);
  });

  return { flat, byStation };
}

// ---------------------------------------------------------------------------
// Build the dataset once per page load
// ---------------------------------------------------------------------------
const AIR_DATA = generateAirData();
const WATER_DATA = generateWaterData();

const isAirStation = (s) => s.type === 'AIR' || s.type === 'BOTH';
const isWaterStation = (s) => s.type === 'WATER' || s.type === 'BOTH';

// ---------------------------------------------------------------------------
// Alerts (derived from the latest readings + a couple of historical ones)
// ---------------------------------------------------------------------------
function buildAlerts() {
  const alerts = [];
  let n = 0;
  const recent = Date.now() - 6 * HOUR; // only alert on readings from the last 6h

  AIR_DATA.byStation.forEach((series, stationId) => {
    const latest = series[series.length - 1];
    if (!latest || new Date(latest.recordedAt).getTime() < recent) return;
    const station = BASE_STATIONS.find((s) => s.id === stationId);
    let severity = null;
    let threshold = null;
    if (latest.aqi >= 401) { severity = 'CRITICAL'; threshold = 400; }
    else if (latest.aqi >= 301) { severity = 'HIGH'; threshold = 300; }
    else if (latest.aqi >= 201) { severity = 'HIGH'; threshold = 200; }
    else if (latest.aqi >= 151) { severity = 'MODERATE'; threshold = 150; }
    if (severity) {
      n += 1;
      alerts.push({
        id: `AL-${String(n).padStart(3, '0')}`,
        stationId,
        stationName: station.name,
        stationCode: station.code,
        type: 'AIR',
        severity,
        message: `${station.name}: AQI reached ${latest.aqi} (${getAQICategory(latest.aqi).label}), driven by ${PARAM_LIMITS[latest.dominant].label}.`,
        value: latest.aqi,
        threshold,
        createdAt: latest.recordedAt,
        status: 'OPEN',
      });
    }
  });

  WATER_DATA.byStation.forEach((series, stationId) => {
    const latest = series[series.length - 1];
    if (!latest) return;
    const station = BASE_STATIONS.find((s) => s.id === stationId);
    const issues = [];
    if (latest.turbidity > 5) issues.push({ severity: 'MODERATE', threshold: 5, message: `${station.name}: turbidity ${latest.turbidity} NTU is above the 5 NTU limit.`, value: latest.turbidity });
    if (latest.ph < 6.5 || latest.ph > 8.5) issues.push({ severity: 'HIGH', threshold: 8.5, message: `${station.name}: pH ${latest.ph} is outside the 6.5–8.5 range.`, value: latest.ph });
    if (latest.do < 4) issues.push({ severity: 'HIGH', threshold: 4, message: `${station.name}: dissolved oxygen ${latest.do} mg/L is critically low.`, value: latest.do });
    if (latest.tds > 800) issues.push({ severity: 'MODERATE', threshold: 500, message: `${station.name}: TDS ${latest.tds} ppm exceeds the 500 ppm guideline.`, value: latest.tds });
    issues.slice(0, 1).forEach((issue) => {
      n += 1;
      alerts.push({
        id: `AL-${String(n).padStart(3, '0')}`,
        stationId,
        stationName: station.name,
        stationCode: station.code,
        type: 'WATER',
        severity: issue.severity,
        message: issue.message,
        value: issue.value,
        threshold: issue.threshold,
        createdAt: latest.recordedAt,
        status: 'OPEN',
      });
    });
  });

  // Two historical, already-resolved alerts for context.
  n += 1;
  alerts.push({ id: `AL-${String(n).padStart(3, '0')}`, stationId: 'ST-004', stationName: 'Rohini Sector 16', stationCode: 'RHN', type: 'AIR', severity: 'LOW', message: 'Rohini Sector 16: sensor calibration completed after drift detected.', value: 2.1, threshold: 2, createdAt: new Date(Date.now() - 2.4 * 24 * HOUR).toISOString(), status: 'RESOLVED' });
  n += 1;
  alerts.push({ id: `AL-${String(n).padStart(3, '0')}`, stationId: 'ST-003', stationName: 'Yamuna Ghat — ITO', stationCode: 'ITO', type: 'WATER', severity: 'MODERATE', message: 'Yamuna Ghat — ITO: turbidity spike returned to normal after rainfall stopped.', value: 5.2, threshold: 5, createdAt: new Date(Date.now() - 1.3 * 24 * HOUR).toISOString(), status: 'RESOLVED' });

  // Newest first.
  return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

let ALERTS = buildAlerts();

// ---------------------------------------------------------------------------
// Demo accounts
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  { id: 'U-001', name: 'Asha Verma', email: 'admin@ems.io', password: 'admin123', role: 'ADMIN' },
  { id: 'U-002', name: 'Ravi Kumar', email: 'operator@ems.io', password: 'operator123', role: 'OPERATOR' },
  { id: 'U-003', name: 'Meera Nair', email: 'viewer@ems.io', password: 'viewer123', role: 'VIEWER' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const avg = (arr) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

function cityTrend(byStation, stationIds, hours, field) {
  const now = Date.now();
  const out = [];
  for (let i = hours - 1; i >= 0; i--) {
    const t = now - i * HOUR;
    const hourKey = Math.floor(t / HOUR);
    const values = [];
    stationIds.forEach((id) => {
      const series = byStation.get(id);
      if (!series || series.length === 0) return;
      const firstKey = Math.floor(new Date(series[0].recordedAt).getTime() / HOUR);
      const reading = series[hourKey - firstKey];
      if (reading) values.push(reading[field]);
    });
    if (values.length) {
      out.push({ label: chartLabel(new Date(t).toISOString(), hours), value: round(avg(values), 1) });
    }
  }
  return out;
}

function withMeta(reading) {
  if (!reading) return null;
  const category = reading.aqi != null ? getAQICategory(reading.aqi) : getWQICategory(reading.wqi);
  return { ...reading, category: category.label, color: category.color, advice: category.advice };
}

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------
export const mock = {
  // ---- auth ----
  async login(email, password) {
    await delay();
    const users = store.get(KEYS.users, DEMO_USERS);
    const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }
    const { password: _pw, ...safe } = user;
    return { user: safe, token: `mock-token-${user.id}-${Date.now()}` };
  },

  async register({ name, email, password, role }) {
    await delay();
    const users = store.get(KEYS.users, DEMO_USERS);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())) {
      throw new Error('An account with this email already exists.');
    }
    const user = {
      id: `U-${String(users.length + 1).padStart(3, '0')}`,
      name: name.trim(),
      email: email.trim(),
      password,
      role: role || 'VIEWER',
    };
    store.set(KEYS.users, [...users, user]);
    const { password: _pw, ...safe } = user;
    return { user: safe, token: `mock-token-${user.id}-${Date.now()}` };
  },

  // ---- stations ----
  async getStations() {
    await delay();
    const extra = store.get(KEYS.stations, []);
    return [...extra, ...BASE_STATIONS].sort((a, b) => a.code.localeCompare(b.code));
  },

  async addStation(payload) {
    await delay();
    const extra = store.get(KEYS.stations, []);
    const all = [...extra, ...BASE_STATIONS];
    if (all.some((s) => s.name.toLowerCase() === payload.name.toLowerCase().trim())) {
      throw new Error('A station with this name already exists.');
    }
    const newStation = {
      id: `ST-${String(all.length + 1).padStart(3, '0')}`,
      code: (payload.code || payload.name.slice(0, 3)).toUpperCase(),
      name: payload.name.trim(),
      type: payload.type,
      area: payload.area?.trim() || '',
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      status: 'ACTIVE',
      installedAt: new Date().toISOString().slice(0, 10),
      description: payload.description?.trim() || '',
    };
    store.set(KEYS.stations, [...extra, newStation]);
    return newStation;
  },

  // ---- air data ----
  async getAirStations() {
    await delay(120);
    const stations = await this.getStations();
    return stations.filter(isAirStation);
  },

  async getLatestAir(stationId) {
    await delay(120);
    const series = AIR_DATA.byStation.get(stationId);
    return withMeta(series?.[series.length - 1] ?? null);
  },

  async getAirSeries(stationId, hours) {
    await delay();
    const series = AIR_DATA.byStation.get(stationId) ?? [];
    const cutoff = Date.now() - hours * HOUR;
    return series
      .filter((r) => new Date(r.recordedAt).getTime() >= cutoff)
      .map((r) => ({ ...withMeta(r), label: chartLabel(r.recordedAt, hours) }));
  },

  async getAirCitySummary() {
    await delay();
    const stations = (await this.getStations()).filter(isAirStation);
    const byStation = stations.map((station) => ({
      station,
      latest: withMeta(AIR_DATA.byStation.get(station.id)?.slice(-1)[0] ?? null),
    }));
    const reportingIds = stations.filter((s) => s.status !== 'INACTIVE').map((s) => s.id);
    return { byStation, trend: cityTrend(AIR_DATA.byStation, reportingIds, 24, 'aqi') };
  },

  // ---- water data ----
  async getWaterStations() {
    await delay(120);
    const stations = await this.getStations();
    return stations.filter(isWaterStation);
  },

  async getLatestWater(stationId) {
    await delay(120);
    const series = WATER_DATA.byStation.get(stationId);
    return withMeta(series?.[series.length - 1] ?? null);
  },

  async getWaterSeries(stationId, hours) {
    await delay();
    const series = WATER_DATA.byStation.get(stationId) ?? [];
    const cutoff = Date.now() - hours * HOUR;
    return series
      .filter((r) => new Date(r.recordedAt).getTime() >= cutoff)
      .map((r) => ({ ...withMeta(r), label: chartLabel(r.recordedAt, hours) }));
  },

  async getWaterCitySummary() {
    await delay();
    const stations = (await this.getStations()).filter(isWaterStation);
    const byStation = stations.map((station) => ({
      station,
      latest: withMeta(WATER_DATA.byStation.get(station.id)?.slice(-1)[0] ?? null),
    }));
    const reportingIds = stations.filter((s) => s.status !== 'INACTIVE').map((s) => s.id);
    return { byStation, trend: cityTrend(WATER_DATA.byStation, reportingIds, 24, 'wqi') };
  },

  // ---- measurements (operator submissions + sensor feed) ----
  async getRecentMeasurements(limit = 15) {
    await delay();
    const auto = [];
    (await this.getStations()).forEach((station) => {
      if (station.status === 'INACTIVE') return;
      if (isAirStation(station)) {
        const latest = AIR_DATA.byStation.get(station.id)?.slice(-1)[0];
        if (latest) {
          ['pm25', 'pm10', 'no2', 'so2'].forEach((p) => {
            auto.push({
              id: `${latest.id}-${p}`,
              stationId: station.id,
              stationName: station.name,
              parameter: p,
              value: latest[p],
              unit: PARAM_LIMITS[p].unit,
              recordedAt: latest.recordedAt,
              source: 'SENSOR',
              status: 'AUTO-LOGGED',
            });
          });
        }
      }
      if (isWaterStation(station)) {
        const latest = WATER_DATA.byStation.get(station.id)?.slice(-1)[0];
        if (latest) {
          ['ph', 'do', 'turbidity', 'tds'].forEach((p) => {
            auto.push({
              id: `${latest.id}-${p}`,
              stationId: station.id,
              stationName: station.name,
              parameter: p,
              value: latest[p],
              unit: PARAM_LIMITS[p].unit,
              recordedAt: latest.recordedAt,
              source: 'SENSOR',
              status: 'AUTO-LOGGED',
            });
          });
        }
      }
    });

    const operator = store.get(KEYS.measurements, []).map((m) => ({ ...m, source: 'OPERATOR', status: 'VALIDATED' }));
    return [...operator, ...auto]
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .slice(0, limit);
  },

  async addMeasurement({ stationId, stationName, parameter, value, recordedAt }) {
    await delay();
    const error = validateValue(parameter, value);
    if (error) throw new Error(error);
    const list = store.get(KEYS.measurements, []);
    const entry = {
      id: `M-${Date.now()}`,
      stationId,
      stationName,
      parameter,
      value: Number(value),
      unit: PARAM_LIMITS[parameter].unit,
      recordedAt: recordedAt || new Date().toISOString(),
    };
    store.set(KEYS.measurements, [entry, ...list].slice(0, 100));
    return { ...entry, source: 'OPERATOR', status: 'VALIDATED' };
  },

  // ---- alerts ----
  async getAlerts() {
    await delay();
    const overrides = store.get(KEYS.alerts, {});
    return ALERTS.map((a) => (overrides[a.id] ? { ...a, status: overrides[a.id] } : a));
  },

  async updateAlertStatus(id, status) {
    await delay(150);
    const overrides = store.get(KEYS.alerts, {});
    overrides[id] = status;
    store.set(KEYS.alerts, overrides);
    return { id, status };
  },

  // ---- reports ----
  async buildReport({ stationId = 'ALL', hours = 168, detailed = false }) {
    await delay(450);
    const stations = await this.getStations();
    const selected = stationId === 'ALL' ? stations : stations.filter((s) => s.id === stationId);
    const station = stationId === 'ALL' ? null : stations.find((s) => s.id === stationId);
    const cutoff = Date.now() - hours * HOUR;

    const airStations = selected.filter(isAirStation);
    const waterStations = selected.filter(isWaterStation);

    const airReadings = airStations.flatMap((s) => (AIR_DATA.byStation.get(s.id) ?? []).filter((r) => new Date(r.recordedAt).getTime() >= cutoff));
    const waterReadings = waterStations.flatMap((s) => (WATER_DATA.byStation.get(s.id) ?? []).filter((r) => new Date(r.recordedAt).getTime() >= cutoff));

    // Air section ---------------------------------------------------------
    let air = null;
    if (airReadings.length) {
      const pollutants = ['pm25', 'pm10', 'no2', 'so2'].map((key) => {
        const values = airReadings.map((r) => r[key]).filter((v) => v != null);
        return { key, values };
      });
      const stats = pollutants.map(({ key, values }) => {
        const meta = POLLUTANTS[key];
        return {
          key,
          label: meta.label,
          unit: meta.unit,
          limit: meta.limit,
          min: round(Math.min(...values)),
          max: round(Math.max(...values)),
          avg: round(avg(values)),
          exceedances: values.filter((v) => v > meta.limit).length,
        };
      });
      const aqiValues = airReadings.map((r) => r.aqi);
      const categories = {};
      airReadings.forEach((r) => {
        const cat = getAQICategory(r.aqi).label;
        categories[cat] = (categories[cat] || 0) + 1;
      });
      air = {
        samples: airReadings.length,
        stats,
        aqi: {
          min: Math.min(...aqiValues),
          max: Math.max(...aqiValues),
          avg: round(avg(aqiValues), 1),
        },
        categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
      };
    }

    // Water section -------------------------------------------------------
    let water = null;
    if (waterReadings.length) {
      const stats = ['ph', 'do', 'turbidity', 'tds'].map((key) => {
        const values = waterReadings.map((r) => r[key]).filter((v) => v != null);
        const meta = WATER_PARAMS[key];
        return {
          key,
          label: meta.label,
          unit: meta.unit,
          ideal: meta.ideal,
          min: round(Math.min(...values), 2),
          max: round(Math.max(...values), 2),
          avg: round(avg(values), 2),
        };
      });
      const wqiValues = waterReadings.map((r) => r.wqi);
      const categories = {};
      waterReadings.forEach((r) => {
        const cat = getWQICategory(r.wqi).label;
        categories[cat] = (categories[cat] || 0) + 1;
      });
      water = {
        samples: waterReadings.length,
        stats,
        wqi: {
          min: Math.min(...wqiValues),
          max: Math.max(...wqiValues),
          avg: round(avg(wqiValues), 1),
        },
        categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
      };
    }

    // Alerts in the period -------------------------------------------------
    const alerts = ALERTS.filter((a) => new Date(a.createdAt).getTime() >= cutoff && (!station || a.stationId === station.id));

    // Detailed reports use one row per measurement, matching the database API.
    // The mock source groups parameters by sensor timestamp, but those rows are
    // flattened independently and do not claim to share a sampling event.
    let readings = null;
    if (detailed) {
      const stationName = new Map(stations.map((item) => [item.id, item.name]));
      const airRows = airReadings.flatMap((reading) => Object.keys(POLLUTANTS)
        .filter((code) => reading[code] != null)
        .map((code) => ({
          id: `${reading.id}:${code}`,
          stationId: reading.stationId,
          stationName: stationName.get(reading.stationId) || null,
          recordedAt: reading.recordedAt,
          timestamp: reading.recordedAt,
          kind: 'AIR',
          parameterCode: code,
          parameterLabel: POLLUTANTS[code].label,
          value: reading[code],
          unit: POLLUTANTS[code].unit,
          aqi: reading.aqi ?? null,
          wqi: null,
        })));
      const waterRows = waterReadings.flatMap((reading) => Object.keys(WATER_PARAMS)
        .filter((code) => reading[code] != null)
        .map((code) => ({
          id: `${reading.id}:${code}`,
          stationId: reading.stationId,
          stationName: stationName.get(reading.stationId) || null,
          recordedAt: reading.recordedAt,
          timestamp: reading.recordedAt,
          kind: 'WATER',
          parameterCode: code,
          parameterLabel: WATER_PARAMS[code].label,
          value: reading[code],
          unit: WATER_PARAMS[code].unit,
          aqi: null,
          wqi: reading.wqi ?? null,
        })));
      readings = [...airRows, ...waterRows]
        .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt) || a.id.localeCompare(b.id))
        .slice(0, 15);
    }

    return {
      generatedAt: new Date().toISOString(),
      stationId,
      stationName: station ? station.name : 'All stations',
      hours,
      air,
      water,
      alerts,
      readings,
    };
  },
};
