const { PrismaClient } = require('../config');

class Alert {
  constructor(data = {}) {
    this.id = data.id || '';
    this.stationId = data.stationId || '';
    this.type = data.type || 'AQI_HIGH';
    this.severity = data.severity || 'MEDIUM';
    this.status = data.status || 'PENDING';
    this.message = data.message || '';
    this.resolvedAt = data.resolvedAt || null;
  }

  static async create(data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      const alertData = {
        stationId: data.stationId,
        type: data.type?.toUpperCase() || 'AQI_HIGH',
        severity: data.severity?.toUpperCase() || 'MEDIUM',
        status: data.status?.toUpperCase() || 'PENDING',
        message: data.message || '',
      };

      return await prisma.alert.create({ data: alertData });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async find(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.alert.findFirst({ where: { id }, include: { station: true } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findById(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const alert = await prisma.alert.findFirst({ where: { id }, include: { station: true } });
      return alert ? new Alert(alert) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findAll(query = {}) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      const where = {};
      if (query.stationId) where.stationId = query.stationId;
      if (query.type) where.type = query.type?.toUpperCase();
      if (query.severity) where.severity = query.severity?.toUpperCase();
      if (query.status) where.status = query.status?.toUpperCase();

      return await prisma.alert.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async update(id, data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.alert.update({ where: { id }, data });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async resolve(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.alert.update({ 
        where: { id }, 
        data: { status: 'RESOLVED', resolvedAt: new Date() } 
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async acknowledge(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.alert.update({ 
        where: { id }, 
        data: { status: 'ACKNOWLEDGED' } 
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async delete(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.alert.delete({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }
}

module.exports = Alert;
