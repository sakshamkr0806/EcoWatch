const express = require('express');
const auth = require('../middleware/auth');
const { submitMeasurement } = require('../services/measurementSubmission');

const router = express.Router();

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
