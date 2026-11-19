const prisma = require('../config');

exports.create = async (data) => {
  return await prisma.station.create({ data });
};

exports.findById = async (id) => {
  return await prisma.station.findUnique({ where: { id } });
};

exports.findByUser = async (userId) => {
  return await prisma.station.findMany({ 
    where: { userId },
    include: { airReadings: true, waterReadings: true } 
  });
};

exports.findAll = async () => {
  return await prisma.station.findMany();
};

exports.update = async (id, data) => {
  return await prisma.station.update({ where: { id }, data });
};

exports.delete = async (id) => {
  return await prisma.station.delete({ where: { id } });
};

exports.findByType = async (type) => {
  return await prisma.station.findMany({ 
    where: { type, isActive: true },
    include: { airReadings: true, waterReadings: true } 
  });
};
