const prisma = require('../config');

exports.create = async (data) => prisma.monitoringstation.create({ data });

exports.findById = async (id) => prisma.monitoringstation.findUnique({ where: { id } });

exports.findByUser = async (userId) => prisma.monitoringstation.findMany({
  where: { stationassignments: { some: { userid: userId, endedat: null } } },
});

exports.findAll = async (args = {}) => prisma.monitoringstation.findMany(args);

exports.update = async (id, data) => prisma.monitoringstation.update({ where: { id }, data });

exports.delete = async (id) => prisma.monitoringstation.delete({ where: { id } });

exports.findByType = async (stationtype) => prisma.monitoringstation.findMany({
  where: { stationtype, status: 'ACTIVE' },
});
