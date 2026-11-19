const prisma = require('../config');

exports.createAlert = async (stationId, type, severity, message) => {
  const severityMap = { Severe: 'HIGH', 'Very Poor': 'MEDIUM', Fair: 'MEDIUM', Satisfactory: 'LOW' };
  const mappedSeverity = severity ? severityMap[severity] : severity;

  return await prisma.alert.create({
    data: { stationId, type, severity: mappedSeverity, message },
  });
};

exports.getAlertsByStation = async (stationId) => {
  return await prisma.alert.findMany({
    where: { stationId },
    orderBy: { createdAt: 'desc' },
  });
};

exports.getUnacknowledgedAlerts = async () => {
  return await prisma.alert.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
};

exports.updateAlertStatus = async (alertId, status) => {
  return await prisma.alert.update({
    where: { id: alertId },
    data: { status },
  });
};

exports.getAllAlerts = async () => {
  return await prisma.alert.findMany({
    include: { station: true },
    orderBy: { createdAt: 'desc' },
  });
};

exports.deleteAlert = async (alertId) => {
  return await prisma.alert.delete({
    where: { id: alertId },
  });
};
