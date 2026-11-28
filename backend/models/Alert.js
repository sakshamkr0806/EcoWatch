const prisma = require('../config');

// Persistence helpers use only the canonical Alert model fields. Alert creation
// remains the responsibility of a caller with an established generation rule.
exports.createAlert = async (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Canonical alert data is required');
  }
  const { stationid, title, message, dedupekey } = data;
  if (!stationid || !title || !message || !dedupekey) {
    throw new TypeError('stationid, title, message, and dedupekey are required');
  }
  return prisma.alert.create({ data });
};

exports.getAlertsByStation = async (stationid) => prisma.alert.findMany({
  where: { stationid },
  orderBy: { createdat: 'desc' },
});

exports.getUnacknowledgedAlerts = async () => prisma.alert.findMany({
  where: { status: 'OPEN' },
  orderBy: { createdat: 'asc' },
});

exports.updateAlertStatus = async (alertId, status, userId) => {
  if (!['ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
    throw new TypeError('Unsupported alert status transition');
  }
  const current = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!current) return null;
  const allowed = (current.status === 'OPEN' && ['ACKNOWLEDGED', 'RESOLVED'].includes(status)) ||
    (current.status === 'ACKNOWLEDGED' && status === 'RESOLVED');
  if (!allowed) throw new TypeError(`Cannot change alert from ${current.status} to ${status}`);
  const data = status === 'ACKNOWLEDGED'
    ? { status, acknowledgedat: new Date(), ...(userId && { acknowledgedByUser: { connect: { id: userId } } }) }
    : { status, resolvedat: new Date(), ...(userId && { resolvedbyuserid: userId }) };
  return prisma.alert.update({ where: { id: alertId }, data });
};

exports.getAllAlerts = async () => prisma.alert.findMany({
  include: { stations: true },
  orderBy: { createdat: 'desc' },
});

exports.deleteAlert = async (alertId) => prisma.alert.delete({
  where: { id: alertId },
});
