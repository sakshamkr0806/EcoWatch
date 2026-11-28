const prisma = require('../config');
const domainFilter = { parameters: { is: { domain: 'AIR' } } };

async function create(data) {
  return prisma.measurement.create({ data });
}

async function findAll(args = {}) {
  return prisma.measurement.findMany({ ...args, where: { AND: [domainFilter, args.where || {}] } });
}

async function findByStationId(stationid, args = {}) {
  return findAll({ ...args, where: { stationid, ...args.where }, orderBy: args.orderBy || { measuredat: 'desc' } });
}

async function findById(id) {
  return prisma.measurement.findFirst({ where: { id, ...domainFilter } });
}

async function update(id, data) {
  const existing = await findById(id);
  if (!existing) return null;
  return prisma.measurement.update({ where: { id }, data });
}

async function deleteRead(id) {
  const existing = await findById(id);
  if (!existing) return null;
  return prisma.measurement.delete({ where: { id } });
}

async function getLatest(stationid) {
  const readings = await findByStationId(stationid, { take: 1 });
  return readings[0] || null;
}

module.exports = { create, findAll, findByStationId, findById, update, delete: deleteRead, getLatest };
