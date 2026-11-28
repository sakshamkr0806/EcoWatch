const prisma = require('../config');
const domainFilter = { parameters: { is: { domain: 'WATER' } } };

exports.create = async (data) => prisma.measurement.create({ data });

exports.findAll = async (args = {}) => prisma.measurement.findMany({
  ...args,
  where: { AND: [domainFilter, args.where || {}] },
});

exports.findByStationId = async (stationid, args = {}) => exports.findAll({
  ...args,
  where: { stationid, ...args.where },
  orderBy: args.orderBy || { measuredat: 'desc' },
});

exports.findById = async (id) => prisma.measurement.findFirst({ where: { id, ...domainFilter } });

exports.update = async (id, data) => {
  const existing = await exports.findById(id);
  if (!existing) return null;
  return prisma.measurement.update({ where: { id }, data });
};

exports.delete = async (id) => {
  const existing = await exports.findById(id);
  if (!existing) return null;
  return prisma.measurement.delete({ where: { id } });
};

exports.getLatest = async (stationid) => {
  const readings = await exports.findByStationId(stationid, { take: 1 });
  return readings[0] || null;
};
