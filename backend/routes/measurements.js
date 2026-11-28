const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config');
const { submitMeasurement } = require('../services/measurementSubmission');

const router = express.Router();

router.get('/recent', auth, auth.requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const rawLimit = req.query.limit;
  const limit = rawLimit === undefined ? 15 : Number(rawLimit);
  if (rawLimit !== undefined && (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit))) {
    return res.status(400).json({ error: 'Limit must be an integer between 1 and 100' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Limit must be an integer between 1 and 100' });
  }

  const where = { validationstatus: 'ACCEPTED' };
  if (req.user.roles.includes('OPERATOR') && !req.user.roles.includes('ADMIN')) {
    where.stations = {
      is: {
        stationassignments: {
          some: {
            userid: req.user.id,
            endedat: null,
          },
        },
      },
    };
  }

  try {
    const rows = await prisma.measurement.findMany({
      where,
      include: {
        stations: true,
        parameters: { include: { units: true } },
      },
      orderBy: [
        { measuredat: 'desc' },
        { createdat: 'desc' },
      ],
      take: limit,
    });

    return res.json(rows.map((row) => ({
      id: row.id,
      stationId: row.stations.id,
      stationName: row.stations.name,
      stationType: row.stations.stationtype,
      domain: row.parameters.domain,
      parameter: row.parameters.code.toLowerCase(),
      parameterId: row.parameterid,
      parameterName: row.parameters.name,
      value: Number(row.value),
      unit: row.parameters.units.symbol,
      recordedAt: new Date(row.measuredat).toISOString(),
      source: row.source,
      validationStatus: row.validationstatus,
      status: 'VALIDATED',
    })));
  } catch (error) {
    console.error('Recent measurements query failed:', error.message);
    return res.status(500).json({ error: 'Unable to load recent measurements' });
  }
});

router.post('/', auth, auth.requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const { domain } = req.body || {};
  if (domain !== undefined && !['AIR', 'WATER'].includes(domain)) {
    return res.status(400).json({ error: 'Domain must be AIR or WATER' });
  }

  const result = await submitMeasurement({
    stationId: req.body?.stationId,
    parameterInput: req.body?.parameterId ?? req.body?.parameter,
    value: req.body?.value,
    timestamp: req.body?.timestamp ?? req.body?.recordedAt,
    source: req.body?.source ?? 'MANUAL',
    expectedDomain: domain,
    user: req.user,
    rejectInactiveStation: true,
    rejectFutureTimestamp: true,
  });
  return res.status(result.status).json(result.body);
});

module.exports = router;
