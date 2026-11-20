const { PrismaClient } = require('../config');

class Station {
  constructor(data = {}) {
    this.id = data.id || '';
    this.code = data.code || '';
    this.name = data.name || '';
    this.type = data.type || 'AIR';
    this.area = data.area || '';
    this.lat = data.lat || 0;
    this.lng = data.lng || 0;
    this.status = data.status || 'ACTIVE';
    this.installedAt = data.installedAt || new Date();
    this.description = data.description || null;
  }

  static async create(data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.station.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type.toUpperCase(),
          area: data.area,
          lat: Number(data.lat),
          lng: Number(data.lng),
          status: data.status?.toUpperCase() || 'ACTIVE',
          installedAt: new Date(data.installedAt),
          description: data.description,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async find(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.station.findFirst({ where: { id }, include: { airReadings: true, waterReadings: true } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findById(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const station = await prisma.station.findFirst({ where: { id }, include: { airReadings: true, waterReadings: true } });
      return station ? new Station(station) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findByCode(code) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const stations = await prisma.station.findMany({ where: { code }, include: { airReadings: true, waterReadings: true } });
      return stations.length > 0 ? stations[0] : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findList(query = {}) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const where = {};
      if (query.area) where.area = query.area.toLowerCase();
      if (query.type) where.type = query.type.toUpperCase();
      if (query.status) where.status = query.status.toUpperCase();

      return await prisma.station.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: { airReadings: true, waterReadings: true },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async delete(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.station.delete({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }
}

module.exports = Station;
