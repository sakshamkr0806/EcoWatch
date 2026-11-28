const express = require('express');
const prisma = require('../config');
const auth = require('../middleware/auth');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function finiteValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeValues(values) {
  const numbers = values.map(finiteValue).filter((value) => value !== null);
  if (!numbers.length) return { min: null, avg: null, max: null };
  return {
    min: round(Math.min(...numbers)),
    avg: round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length),
    max: round(Math.max(...numbers)),
  };
}

function categoryCounts(results) {
  const counts = new Map();
  for (const result of results) {
    if (typeof result.category !== 'string' || !result.category.trim()) continue;
    const name = result.category.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

function parameterStats(readings, domain, methodVersionId = null) {
  const byParameter = new Map();
  for (const row of readings) {
    const parameter = row.parameters;
    if (!parameter) continue;
    const key = parameter.code;
    if (!byParameter.has(key)) byParameter.set(key, { parameter, values: [] });
    byParameter.get(key).values.push(finiteValue(row.value));
  }
  return [...byParameter.values()].map(({ parameter, values }) => {
    const stats = summarizeValues(values);
    const configs = methodVersionId
      ? (parameter.wqiparameterconfigs || []).filter((entry) => entry.methodversionid === methodVersionId)
      : [];
    const config = configs.length === 1 ? configs[0] : null;
    return {
      key: String(parameter.code).toLowerCase(),
      label: parameter.name,
      unit: parameter.units?.symbol || null,
      ...stats,
      // No universal pollutant limit/ideal is stored on parameter. Avoid guessing a method.
      limit: domain === 'AIR' ? null : undefined,
      exceedances: domain === 'AIR' ? null : undefined,
      ideal: domain === 'WATER' && config ? finiteValue(config.idealvalue) : (domain === 'WATER' ? null : undefined),
    };
  });
}

function detailedRows(readings, indexResults) {
  const resultCandidatesByMeasurementId = new Map();
  for (const result of indexResults) {
    for (const link of result.indexresultmeasurements || []) {
      const measurement = link.measurements;
      if (!measurement) continue;
      const type = result.methodversions?.indextype;
      if (type !== 'AQI' && type !== 'WQI') continue;
      const entries = resultCandidatesByMeasurementId.get(measurement.id) || [];
      entries.push({ type, value: finiteValue(result.value) });
      resultCandidatesByMeasurementId.set(measurement.id, entries);
    }
  }

  // MeasurementBatch represents an import/upload batch, not a shared sampling
  // event. Keep each measurement separate rather than imply timestamp equality
  // means the parameters were sampled together.
  return [...readings].sort((a, b) => {
    const timeOrder = new Date(b.measuredat) - new Date(a.measuredat);
    return timeOrder || String(a.id).localeCompare(String(b.id));
  }).slice(0, 15).map((row) => {
    const domain = row.parameters?.domain;
    if (!domain) return null;
    const recordedAt = new Date(row.measuredat).toISOString();
    const candidates = resultCandidatesByMeasurementId.get(row.id) || [];
    const indexValue = (type) => {
      const values = candidates.filter((candidate) => candidate.type === type).map((candidate) => candidate.value);
      return values.length && values.every((value) => value === values[0]) ? values[0] : null;
    };
    return {
      id: row.id,
      stationId: row.stationid,
      stationName: row.stations?.name || null,
      recordedAt,
      kind: domain,
      parameterCode: String(row.parameters.code).toLowerCase(),
      parameterLabel: row.parameters.name,
      value: finiteValue(row.value),
      unit: row.parameters.units?.symbol || null,
      aqi: domain === 'AIR' ? indexValue('AQI') : null,
      wqi: domain === 'WATER' ? indexValue('WQI') : null,
    };
  }).filter(Boolean);
}

function dailyIndexSummary(results, type) {
  const byDate = new Map();
  for (const result of results.filter((entry) => entry.methodversions?.indextype === type && entry.value != null)) {
    const date = new Date(result.calculatedat).toISOString().slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(Number(result.value));
  }
  return [...byDate.entries()].map(([date, values]) => ({
    date,
    readings: values.length,
    avgAQI: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    maxAQI: Math.max(...values),
    minAQI: Math.min(...values),
  }));
}

async function buildReport(req, res) {
  try {
    const body = req.body || {};
    const stationId = body.stationId ?? 'ALL';
    const domain = body.domain;
    if (stationId !== 'ALL' && (typeof stationId !== 'string' || !UUID.test(stationId))) {
      return res.status(400).json({ error: 'Station ID must be ALL or a valid ID' });
    }
    if (domain !== undefined && !['AIR', 'WATER'].includes(domain)) {
      return res.status(400).json({ error: 'Domain must be AIR or WATER' });
    }
    if (body.detailed !== undefined && typeof body.detailed !== 'boolean') {
      return res.status(400).json({ error: 'Detailed must be a boolean' });
    }

    let startDate;
    let endDate;
    let hours;
    if (body.from !== undefined || body.to !== undefined) {
      if (typeof body.from !== 'string' || typeof body.to !== 'string' || Number.isNaN(Date.parse(body.from)) || Number.isNaN(Date.parse(body.to))) {
        return res.status(400).json({ error: 'Both from and to must be valid dates' });
      }
      startDate = new Date(body.from);
      endDate = new Date(body.to);
      if (startDate > endDate) return res.status(400).json({ error: '`from` must not be after `to`' });
      hours = round((endDate - startDate) / 3_600_000, 2);
    } else {
      hours = body.hours === undefined ? 168 : Number(body.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 366) {
        return res.status(400).json({ error: 'Hours must be greater than 0 and no greater than 8784' });
      }
      endDate = new Date();
      startDate = new Date(endDate.getTime() - hours * 3_600_000);
    }

    const stationWhere = {
      ...(stationId !== 'ALL' && { id: stationId }),
      ...(!req.user.roles.includes('ADMIN') && {
        stationassignments: { some: { userid: req.user.id, endedat: null } },
      }),
    };
    const stations = await prisma.monitoringstation.findMany({
      where: stationWhere,
      select: { id: true, name: true, stationtype: true },
    });
    if (stationId !== 'ALL' && !stations.length) return res.status(404).json({ error: 'Station not found or not assigned to this user' });
    const selectedStations = stations.filter((station) => !domain || station.stationtype === 'BOTH' || station.stationtype === domain);
    if (stationId !== 'ALL' && domain && !selectedStations.length) {
      return res.status(400).json({ error: 'Station is not compatible with the requested domain' });
    }
    const selectedIds = selectedStations.map((station) => station.id);
    const stationById = new Map(selectedStations.map((station) => [station.id, station]));

    const measurementRows = selectedIds.length ? await prisma.measurement.findMany({
      where: {
        stationid: { in: selectedIds },
        measuredat: { gte: startDate, lte: endDate },
        validationstatus: 'ACCEPTED',
        ...(domain && { parameters: { is: { domain } } }),
      },
      include: {
        stations: { select: { id: true, name: true, stationtype: true } },
        parameters: {
          include: {
            units: true,
            ...(domain === 'WATER' || !domain ? {
              wqiparameterconfigs: { include: { methodversions: true } },
            } : {}),
          },
        },
      },
      orderBy: { measuredat: 'desc' },
    }) : [];

    const resultRows = selectedIds.length ? await prisma.indexResult.findMany({
      where: {
        stationid: { in: selectedIds },
        periodstart: { lte: endDate },
        periodend: { gte: startDate },
        datastatus: 'SUFFICIENT',
        ...(domain && { methodversions: { is: { indextype: domain === 'AIR' ? 'AQI' : 'WQI' } } }),
      },
      include: {
        methodversions: true,
        indexresultmeasurements: {
          include: { measurements: { select: {
            id: true, stationid: true, measuredat: true, parameterid: true, validationstatus: true,
            parameters: { select: { domain: true } },
          } } },
        },
      },
    }) : [];
    const measurementIds = new Set(measurementRows.map((row) => row.id));
    const linkedResults = resultRows.filter((result) => {
      const type = result.methodversions?.indextype;
      const expectedDomain = type === 'AQI' ? 'AIR' : type === 'WQI' ? 'WATER' : null;
      const links = result.indexresultmeasurements || [];
      return expectedDomain && links.length > 0 && links.every(({ measurements: measurement }) =>
        measurement && measurement.stationid === result.stationid && measurement.validationstatus === 'ACCEPTED' &&
        measurement.parameters?.domain === expectedDomain && measurementIds.has(measurement.id)
      );
    });
    const airReadings = domain === 'WATER' ? [] : measurementRows.filter((row) => row.parameters?.domain === 'AIR');
    const waterReadings = domain === 'AIR' ? [] : measurementRows.filter((row) => row.parameters?.domain === 'WATER');
    // The schema has version metadata and an isactive flag, but no constraint or
    // policy identifying one authoritative version. If multiple versions occur
    // in this report window, suppress that index rather than mix incomparable values.
    function unambiguousVersionResults(type) {
      const candidates = linkedResults.filter((row) => row.methodversions?.indextype === type);
      const versions = new Set(candidates.map((row) => row.methodversionid));
      if (versions.size !== 1) return { rows: [], methodVersionId: null };
      const methodVersionId = versions.values().next().value;
      return { rows: candidates.filter((row) => row.value != null), methodVersionId };
    }
    const { rows: airIndices, methodVersionId: airMethodVersionId } = unambiguousVersionResults('AQI');
    const { rows: waterIndices, methodVersionId: waterMethodVersionId } = unambiguousVersionResults('WQI');
    const methodVersionDetails = (id) => {
      if (!id) return null;
      const result = linkedResults.find((row) => row.methodversionid === id);
      return result ? { id, version: result.methodversions.version, name: result.methodversions.methodname } : null;
    };

    const air = airReadings.length || airIndices.length ? {
      samples: airReadings.length,
      stats: parameterStats(airReadings, 'AIR'),
      aqi: summarizeValues(airIndices.map((row) => row.value)),
      indexMethodVersion: methodVersionDetails(airMethodVersionId),
      categories: categoryCounts(airIndices),
    } : null;
    const water = waterReadings.length || waterIndices.length ? {
      samples: waterReadings.length,
      stats: parameterStats(waterReadings, 'WATER', waterMethodVersionId),
      wqi: summarizeValues(waterIndices.map((row) => row.value)),
      indexMethodVersion: methodVersionDetails(waterMethodVersionId),
      categories: categoryCounts(waterIndices),
    } : null;

    const alerts = selectedIds.length ? await prisma.alert.findMany({
      where: { stationid: { in: selectedIds }, createdat: { gte: startDate, lte: endDate } },
      include: {
        stations: { select: { id: true, stationtype: true } },
        measurements: { select: { parameters: { select: { domain: true } } } },
        indexresults: { select: { methodversions: { select: { indextype: true } } } },
      },
      orderBy: { createdat: 'desc' },
    }) : [];
    const mappedAlerts = alerts.map((alert) => {
      const linkedDomains = [
        alert.measurements?.parameters?.domain,
        alert.indexresults?.methodversions?.indextype === 'AQI' ? 'AIR' :
          alert.indexresults?.methodversions?.indextype === 'WQI' ? 'WATER' : null,
      ].filter(Boolean);
      const linkedDomain = linkedDomains.length && linkedDomains.every((value) => value === linkedDomains[0])
        ? linkedDomains[0]
        : null;
      const stationDomain = ['AIR', 'WATER'].includes(alert.stations?.stationtype) ? alert.stations.stationtype : null;
      return {
        id: alert.id,
        stationId: alert.stationid,
        type: linkedDomains.length ? linkedDomain : stationDomain,
        message: alert.message,
        createdAt: alert.createdat,
        status: alert.status,
      };
    });
    const station = stationId === 'ALL' ? null : stationById.get(stationId);
    const response = {
      generatedAt: new Date().toISOString(),
      stationId,
      stationName: station?.name || 'All stations',
      hours,
      air,
      water,
      alerts: mappedAlerts,
      readings: body.detailed ? detailedRows(measurementRows, [...airIndices, ...waterIndices]) : null,
      period: { from: startDate.toISOString(), to: endDate.toISOString() },
      airQuality: dailyIndexSummary(airIndices, 'AQI'),
      waterQuality: dailyIndexSummary(waterIndices, 'WQI'),
    };
    return res.json(response);
  } catch (error) {
    console.error('Report generation failed:', error.message);
    return res.status(500).json({ error: 'Unable to generate report' });
  }
}

router.post('/', auth, auth.requireRole('ADMIN', 'OPERATOR'), buildReport);
router.post('/generate', auth, auth.requireRole('ADMIN', 'OPERATOR'), buildReport);

module.exports = router;
