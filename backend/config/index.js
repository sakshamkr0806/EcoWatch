const { PrismaClient } = require('prisma');

const prisma = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : false });

module.exports = prisma;
