const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set before initializing Prisma Client.');
}

const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: true },
});
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
