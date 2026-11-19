const prisma = require('../config');

exports.create = async (data) => {
  return await prisma.user.create({ data });
};

exports.findById = async (id) => {
  return await prisma.user.findUnique({ where: { id } });
};

exports.findByEmail = async (email) => {
  return await prisma.user.findUnique({ where: { email } });
};

exports.findAll = async () => {
  return await prisma.user.findMany();
};

exports.update = async (id, data) => {
  return await prisma.user.update({ where: { id }, data });
};

exports.delete = async (id) => {
  return await prisma.user.delete({ where: { id } });
};
