const prisma = require('../config');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set(['MANUAL', 'CSV', 'API', 'SENSOR']);
const INCLUDE = {
  stations: true,
  parameters: { include: { units: true } },
  indexresultmeasurements: {
    include: { indexresults: { include: { methodversions: true } } },
  },
};

function responseFor(row, station) {
  const parameter = row.parameters || {};
  return {
    id: row.id,
    stationId: row.stationid,
    stationName: station.name,
    stationType: station.stationtype,
    parameter: String(parameter.code || '').toLowerCase(),
    parameterId: row.parameterid,
    parameterName: parameter.name || null,
    value: Number(row.value),
    unit: parameter.units?.symbol || null,
    recordedAt: new Date(row.measuredat).toISOString(),
    source: row.source,
    validationStatus: row.validationstatus,
    aqi: null,
    aqiCategory: null,
    wqi: null,
    wqiCategory: null,
  };
}

function failure(status, error) {
  return { status, body: { error } };
}

async function submitMeasurement({ stationId, parameterInput, value, timestamp, user, expectedDomain, source = 'MANUAL', rejectInactiveStation = false, rejectFutureTimestamp = false }) {
  if (typeof stationId !== 'string' || !UUID.test(stationId)) return failure(400, 'A valid station ID is required');
  if (typeof timestamp !== 'string' && !(timestamp instanceof Date)) return failure(400, 'A valid timestamp is required');
  const measuredat = new Date(timestamp);
  if (Number.isNaN(measuredat.getTime())) return failure(400, 'A valid timestamp is required');
  if (rejectFutureTimestamp && measuredat.getTime() > Date.now() + 60_000) return failure(400, 'Measurement time cannot be in the future');
  const numericInput = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  if (!numericInput || !Number.isFinite(Number(value))) {
    return failure(400, 'Value must be a finite number');
  }
  if (!SOURCES.has(source)) return failure(400, 'Invalid measurement source');
  if (typeof parameterInput !== 'string' || !parameterInput.trim()) return failure(400, 'A parameter ID or code is required');

  const station = await prisma.monitoringstation.findUnique({ where: { id: stationId } });
  if (!station) return failure(404, 'Station not found');
  if (rejectInactiveStation && station.status !== 'ACTIVE') return failure(409, 'Station is not active');

  const parameterValue = parameterInput.trim();
  const parameter = await prisma.parameter.findFirst({
    where: {
      OR: UUID.test(parameterValue)
        ? [{ id: parameterValue }]
        : [{ code: { equals: parameterValue, mode: 'insensitive' } }],
    },
    include: { units: true },
  });
  if (!parameter || !parameter.isactive) return failure(400, 'Parameter is invalid or inactive');
  if (!['AIR', 'WATER'].includes(parameter.domain)) return failure(400, 'Parameter has an invalid domain');
  if (expectedDomain && parameter.domain !== expectedDomain) {
    return failure(400, `Parameter must be an active ${expectedDomain.toLowerCase()} parameter`);
  }
  if (!['BOTH', parameter.domain].includes(station.stationtype)) {
    return failure(400, 'Station is not compatible with the parameter domain');
  }

  if (!user.roles.includes('ADMIN')) {
    const assignment = await prisma.stationAssignment.findFirst({
      where: { userid: user.id, stationid: stationId, endedat: null },
    });
    if (!assignment) return failure(403, 'Station is not assigned to this operator');
  }

  const row = await prisma.measurement.create({
    data: {
      stationid: stationId,
      parameterid: parameter.id,
      value: Number(value),
      measuredat,
      source,
      validationstatus: 'ACCEPTED',
      recordedbyuserid: user.id,
    },
    include: INCLUDE,
  });
  return { status: 201, body: responseFor(row, station) };
}

async function safelySubmit(options) {
  try {
    return await submitMeasurement(options);
  } catch (error) {
    if (error.code === 'P2002') return failure(409, 'Measurement conflicts with an existing record');
    if (error.code === 'P2003') return failure(400, 'Invalid station or parameter reference');
    console.error('Measurement submission failed:', error.message);
    return failure(500, 'Unable to submit measurement');
  }
}

module.exports = { submitMeasurement: safelySubmit };
