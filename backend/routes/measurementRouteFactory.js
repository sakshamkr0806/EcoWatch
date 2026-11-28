const express = require('express');
const prisma = require('../config');
const auth = require('../middleware/auth');
const { submitMeasurement } = require('../services/measurementSubmission');
const { requireRole } = auth;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INDEX_INCLUDE = {
  indexresultmeasurements: {
    include: { indexresults: { include: { methodversions: true } } },
  },
};

function isValidDate(value) {
  return (typeof value === 'string' || value instanceof Date) && !Number.isNaN(new Date(value).getTime());
}

function asIndexResult(measurement, type) {
  for (const link of measurement.indexresultmeasurements || []) {
    const result = link.indexresults;
    if (result?.methodversions?.indextype === type) return result;
  }
  return null;
}

function mapMeasurement(row, domain, station) {
  const parameter = row.parameters || {};
  const code = String(parameter.code || '').toLowerCase();
  const aq = asIndexResult(row, 'AQI');
  const wq = asIndexResult(row, 'WQI');
  const mapped = {
    id: row.id,
    stationId: row.stationid,
    stationName: station?.name || row.stations?.name || null,
    stationType: station?.stationtype || row.stations?.stationtype || null,
    parameter: code,
    parameterId: row.parameterid,
    parameterName: parameter.name || null,
    value: Number(row.value),
    unit: parameter.units?.symbol || null,
    recordedAt: new Date(row.measuredat).toISOString(),
    source: row.source,
    validationStatus: row.validationstatus,
    aqi: aq?.value == null ? null : Number(aq.value),
    aqiCategory: aq?.category || null,
    wqi: wq?.value == null ? null : Number(wq.value),
    wqiCategory: wq?.category || null,
  };
  return mapped;
}

function indexValue(rows, type) {
  for (const row of rows) {
    const result = asIndexResult(row, type);
    if (result?.value != null) return Number(result.value);
  }
  return null;
}

function indexCategory(rows, type) {
  for (const row of rows) {
    const result = asIndexResult(row, type);
    if (result?.category) return result.category;
  }
  return null;
}

function aggregateRows(rows, domain, station) {
  if (!rows.length) return null;
  const latestByCode = new Map();
  for (const row of rows) {
    const code = String(row.parameters?.code || '').toLowerCase();
    if (code && !latestByCode.has(code)) latestByCode.set(code, mapMeasurement(row, domain, station));
  }
  const latest = rows[0];
  const result = {
    id: latest.id,
    stationId: latest.stationid,
    stationName: station?.name || latest.stations?.name || null,
    stationType: station?.stationtype || latest.stations?.stationtype || null,
    recordedAt: new Date(latest.measuredat).toISOString(),
    aqi: indexValue(rows, 'AQI'),
    aqiCategory: indexCategory(rows, 'AQI'),
    wqi: indexValue(rows, 'WQI'),
    wqiCategory: indexCategory(rows, 'WQI'),
  };
  for (const [code, measurement] of latestByCode) result[code] = measurement.value;
  return result;
}

function aggregateSeries(rows, domain, station) {
  const groups = new Map();
  for (const row of rows) {
    const key = new Date(row.measuredat).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([recordedAt, group]) => {
    const item = aggregateRows(group, domain, station);
    return { ...item, recordedAt };
  });
}

function createMeasurementRouter({ domain }) {
  const router = express.Router();
  const parameterDomain = domain;
  const indexType = domain === 'AIR' ? 'AQI' : 'WQI';
  const lowerDomain = domain.toLowerCase();
  const include = { stations: true, parameters: { include: { units: true } }, ...INDEX_INCLUDE };

  async function stationFor(req, res) {
    const id = req.params.stationId || req.query.stationId;
    if (!id || !UUID.test(id)) {
      res.status(400).json({ error: 'A valid station ID is required' });
      return null;
    }
    const station = await prisma.monitoringstation.findUnique({ where: { id } });
    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return null;
    }
    if (!['BOTH', domain].includes(station.stationtype)) {
      res.status(400).json({ error: `Station is not compatible with ${lowerDomain} measurements` });
      return null;
    }
    if (req.user.role !== 'ADMIN') {
      const assignment = await prisma.stationAssignment.findFirst({
        where: { userid: req.user.id, stationid: id, endedat: null },
      });
      if (!assignment) {
        res.status(403).json({ error: 'Station is not assigned to this operator' });
        return null;
      }
    }
    return station;
  }

  async function parameterFor(input) {
    if (typeof input !== 'string' || !input.trim()) return null;
    const value = input.trim();
    return prisma.parameter.findFirst({
      where: {
        OR: UUID.test(value) ? [{ id: value }] : [{ code: { equals: value, mode: 'insensitive' } }],
      },
      include: { units: true },
    });
  }

  async function list(req, res, explicitLatest = false) {
    const station = await stationFor(req, res);
    if (!station) return;
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? (explicitLatest ? 100 : 100) : Number(req.query.limit);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Pagination must use an integer page >= 1 and limit between 1 and 100' });
    }
    const from = req.query.from;
    const to = req.query.to;
    const hours = req.query.hours === undefined ? null : Number(req.query.hours);
    if ((from !== undefined && !isValidDate(from)) || (to !== undefined && !isValidDate(to))) {
      return res.status(400).json({ error: 'Invalid date filter' });
    }
    if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 366)) {
      return res.status(400).json({ error: 'Hours must be a positive number no greater than 8784' });
    }
    if (from && to && new Date(from) > new Date(to)) return res.status(400).json({ error: '`from` must not be after `to`' });
    const parameterInput = req.query.parameterId || req.query.parameter;
    let parameter;
    if (parameterInput !== undefined) {
      parameter = await parameterFor(String(parameterInput));
      if (!parameter || parameter.domain !== parameterDomain || !parameter.isactive) {
        return res.status(400).json({ error: `Parameter must be an active ${lowerDomain} parameter` });
      }
    }
    const measuredat = {};
    if (from) measuredat.gte = new Date(from);
    if (to) measuredat.lte = new Date(to);
    if (hours !== null && !from) measuredat.gte = new Date(Date.now() - hours * 60 * 60 * 1000);
    const where = {
      stationid: station.id,
      parameters: { is: { domain: parameterDomain } },
      validationstatus: 'ACCEPTED',
      ...(parameter && { parameterid: parameter.id }),
      ...(Object.keys(measuredat).length && { measuredat }),
    };
    const rows = await prisma.measurement.findMany({
      where,
      include,
      orderBy: { measuredat: 'desc' },
      skip: explicitLatest ? 0 : (page - 1) * limit,
      take: explicitLatest ? 100 : limit,
    });
    if (explicitLatest) return res.json(aggregateRows(rows, domain, station));
    return res.json(aggregateSeries(rows, domain, station));
  }

  router.use(auth, requireRole('ADMIN', 'OPERATOR'));
  router.post('/stations/:stationId', async (req, res) => {
    const result = await submitMeasurement({
      stationId: req.params.stationId,
      parameterInput: req.body?.parameterId ?? req.body?.parameter ?? req.body?.pollutant,
      value: req.body?.value,
      timestamp: req.body?.timestamp ?? req.body?.recordedAt,
      source: req.body?.source ?? 'MANUAL',
      expectedDomain: domain,
      user: req.user,
    });
    return res.status(result.status).json(result.body);
  });

  router.get('/stations/:stationId', async (req, res) => {
    try { return await list(req, res); }
    catch (error) { console.error(`${domain} measurement list failed:`, error.message); return res.status(500).json({ error: 'Unable to load measurements' }); }
  });
  router.get('/stations/:stationId/latest', async (req, res) => {
    try { return await list(req, res, true); }
    catch (error) { console.error(`${domain} latest measurement failed:`, error.message); return res.status(500).json({ error: 'Unable to load latest measurements' }); }
  });
  router.get('/latest', async (req, res) => {
    try { return await list(req, res, true); }
    catch (error) { console.error(`${domain} latest measurement failed:`, error.message); return res.status(500).json({ error: 'Unable to load latest measurements' }); }
  });
  router.get('/history', async (req, res) => {
    try { return await list(req, res); }
    catch (error) { console.error(`${domain} measurement history failed:`, error.message); return res.status(500).json({ error: 'Unable to load measurement history' }); }
  });
  return router;
}

module.exports = createMeasurementRouter;
