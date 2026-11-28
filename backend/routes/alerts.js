const express = require('express');
const prisma = require('../config');
const auth = require('../middleware/auth');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const STATUSES = new Set(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED']);
const LIST_INCLUDE = {
  stations: { select: { id: true, name: true, stationcode: true, stationtype: true } },
  measurements: { select: { parameters: { select: { domain: true } } } },
  indexresults: { select: { methodversions: { select: { indextype: true } } } },
  rules: { select: { thresholdvalue: true } },
};

function mapAlert(alert, acknowledgedByMe = false) {
  const measurementDomain = alert.measurements?.parameters?.domain;
  const indexType = alert.indexresults?.methodversions?.indextype;
  const indexedDomain = indexType === 'AQI' ? 'AIR' : indexType === 'WQI' ? 'WATER' : null;
  const type = measurementDomain && indexedDomain
    ? (measurementDomain === indexedDomain ? measurementDomain : null)
    : measurementDomain || indexedDomain || (['AIR', 'WATER'].includes(alert.stations?.stationtype)
      ? alert.stations.stationtype
      : null);

  return {
    id: alert.id,
    type,
    stationId: alert.stationid,
    stationName: alert.stations?.name ?? null,
    stationCode: alert.stations?.stationcode ?? null,
    message: alert.message,
    severity: alert.severity,
    status: alert.status,
    threshold: alert.rules?.thresholdvalue == null ? null : Number(alert.rules.thresholdvalue),
    createdAt: alert.createdat,
    acknowledgedAt: alert.acknowledgedat,
    resolvedAt: alert.resolvedat,
    acknowledgedByMe,
  };
}

function parseDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAcknowledgementRelationConflict(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    const normalized = target.map((entry) => String(entry).toLowerCase());
    return normalized.some((entry) => entry.includes('acknowledgedbyuser') || entry.includes('alerttouser')) ||
      (normalized.length === 2 && normalized.includes('a') && normalized.includes('b'));
  }
  return typeof target === 'string' && /acknowledgedByUser|AlertToUser/i.test(target);
}

async function canAccessAlert(alert, user) {
  if (user.roles.includes('ADMIN')) return true;
  return Boolean(await prisma.stationAssignment.findFirst({
    where: { userid: user.id, stationid: alert.stationid, endedat: null },
    select: { id: true },
  }));
}

router.use(auth, auth.requireRole('ADMIN', 'OPERATOR'));

router.get('/', async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Pagination must use page >= 1 and limit between 1 and 100' });
  }
  if (req.query.severity !== undefined && !SEVERITIES.has(req.query.severity)) {
    return res.status(400).json({ error: 'Invalid alert severity' });
  }
  if (req.query.status !== undefined && !STATUSES.has(req.query.status)) {
    return res.status(400).json({ error: 'Invalid alert status' });
  }
  if (req.query.stationId !== undefined && !UUID.test(req.query.stationId)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }
  if (req.query.type !== undefined && !['AIR', 'WATER'].includes(req.query.type)) {
    return res.status(400).json({ error: 'Alert type must be AIR or WATER' });
  }

  const from = req.query.from === undefined ? undefined : parseDate(req.query.from);
  const to = req.query.to === undefined ? undefined : parseDate(req.query.to);
  if ((req.query.from !== undefined && !from) || (req.query.to !== undefined && !to)) {
    return res.status(400).json({ error: 'Invalid alert date filter' });
  }
  if (from && to && from > to) return res.status(400).json({ error: '`from` must not be after `to`' });

  const where = {
    ...(req.query.stationId && { stationid: req.query.stationId }),
    ...(req.query.severity && { severity: req.query.severity }),
    ...(req.query.status && { status: req.query.status }),
    ...((from || to) && { createdat: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
    ...(!req.user.roles.includes('ADMIN') && {
      stations: { is: { stationassignments: { some: { userid: req.user.id, endedat: null } } } },
    }),
  };
  if (req.query.type) {
    const indexType = req.query.type === 'AIR' ? 'AQI' : 'WQI';
    where.OR = [
      { measurements: { is: { parameters: { is: { domain: req.query.type } } } } },
      { indexresults: { is: { methodversions: { is: { indextype: indexType } } } } },
      { stations: { is: { stationtype: req.query.type } } },
    ];
  }

  try {
    const alerts = await prisma.alert.findMany({
      where,
      include: {
        ...LIST_INCLUDE,
        acknowledgedByUser: { where: { id: req.user.id }, select: { id: true } },
      },
      orderBy: { createdat: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return res.json(alerts.map((alert) => mapAlert(alert, Boolean(alert.acknowledgedByUser?.length))));
  } catch (error) {
    console.error('Alert listing failed:', error.message);
    return res.status(500).json({ error: 'Unable to load alerts' });
  }
});

router.get('/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid alert ID' });
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: {
        ...LIST_INCLUDE,
        acknowledgedByUser: { where: { id: req.user.id }, select: { id: true } },
      },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    if (!(await canAccessAlert(alert, req.user))) return res.status(403).json({ error: 'Alert station is not assigned to this operator' });
    return res.json(mapAlert(alert, Boolean(alert.acknowledgedByUser?.length)));
  } catch (error) {
    console.error('Alert lookup failed:', error.message);
    return res.status(500).json({ error: 'Unable to load alert' });
  }
});

router.patch('/:id/status', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid alert ID' });
  const nextStatus = req.body?.status;
  if (!['ACKNOWLEDGED', 'RESOLVED'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Status must be ACKNOWLEDGED or RESOLVED' });
  }
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: { ...LIST_INCLUDE, acknowledgedByUser: { select: { id: true } } },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    if (!(await canAccessAlert(alert, req.user))) return res.status(403).json({ error: 'Alert station is not assigned to this operator' });
    const alreadyAcknowledged = alert.acknowledgedByUser?.some((user) => user.id === req.user.id);
    const validTransition = (alert.status === 'OPEN' && ['ACKNOWLEDGED', 'RESOLVED'].includes(nextStatus)) ||
      (alert.status === 'ACKNOWLEDGED' && nextStatus === 'ACKNOWLEDGED') ||
      (alert.status === 'ACKNOWLEDGED' && nextStatus === 'RESOLVED');
    if (!validTransition) return res.status(409).json({ error: `Cannot change alert from ${alert.status} to ${nextStatus}` });

    // Connecting to the implicit many-to-many relation adds only this user; it
    // never replaces acknowledgers already associated with the alert. Repeated
    // acknowledgement by the same user is an idempotent no-op.
    if (nextStatus === 'ACKNOWLEDGED' && alert.status === 'ACKNOWLEDGED' && alreadyAcknowledged) {
      return res.json(mapAlert(alert, true));
    }
    const data = nextStatus === 'ACKNOWLEDGED'
      ? {
        ...(alert.status === 'OPEN' && { status: nextStatus, acknowledgedat: new Date() }),
        acknowledgedByUser: { connect: { id: req.user.id } },
      }
      : { status: nextStatus, resolvedat: new Date(), resolvedbyuserid: req.user.id };
    let updated;
    try {
      updated = await prisma.alert.update({
        where: { id: alert.id },
        data,
        include: {
          ...LIST_INCLUDE,
          acknowledgedByUser: { where: { id: req.user.id }, select: { id: true } },
        },
      });
    } catch (error) {
      if (nextStatus !== 'ACKNOWLEDGED' || !isAcknowledgementRelationConflict(error)) throw error;
      const refreshed = await prisma.alert.findUnique({
        where: { id: alert.id },
        include: { acknowledgedByUser: { where: { id: req.user.id }, select: { id: true } } },
      });
      if (!refreshed?.acknowledgedByUser?.length) throw error;
      return res.json(mapAlert({ ...alert, ...refreshed }, true));
    }
    return res.json(mapAlert(updated, Boolean(updated.acknowledgedByUser?.length)));
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Alert not found' });
    console.error('Alert status update failed:', error.message);
    return res.status(500).json({ error: 'Unable to update alert status' });
  }
});

module.exports = router;
