const { PrismaClient } = require('../config');
const { computeAQI, subIndex } = require('../utils/aqi');

class AirReading {
  constructor(data = {}) {
    this.id = data.id || '';
    this.stationId = data.stationId || '';
    this.recordedAt = data.recordedAt || new Date();
    this.pm25 = data.pm25 || null;
    this.pm10 = data.pm10 || null;
    this.no2 = data.no2 || null;
    this.so2 = data.so2 || null;
    this.aqi = data.aqi || 0;
    this.dominant = data.dominant || 'pm25';
  }

  static async create(data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      let aqi = 0;
      let dominant = 'pm25';

      if (data.pm25 != null && data.pm25 > 0) {
        const pm25Index = subIndex('pm25', data.pm25);
        if (pm25Index != null && pm25Index > aqi) {
          aqi = pm25Index;
          dominant = 'pm25';
        }
      }

      const airReading = await prisma.air_reading.create({
        data: {
          stationId: data.stationId,
          recordedAt: new Date(data.recordedAt),
          pm25: Number(data.pm25),
          pm10: Number(data.pm10),
          no2: Number(data.no2),
          so2: Number(data.so2),
          aqi,
          dominant,
        },
      });

      return new AirReading(airReading);
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findByStationId(stationId) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.air_reading.findMany({ where: { stationId }, orderBy: { recordedAt: 'desc' } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findById(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const reading = await prisma.air_reading.findFirst({ where: { id }, include: { station: true } });
      return reading ? new AirReading(reading) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async update(id, data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      let aqi = 0;
      let dominant = 'pm25';

      if (data.pm25 != null && data.pm25 > 0) {
        const pm25Index = subIndex('pm25', data.pm25);
        if (pm25Index != null && pm25Index > aqi) {
          aqi = pm25Index;
          dominant = 'pm25';
        }
      }

      return await prisma.air_reading.update({ where: { id }, data: { ...data, aqi, dominant } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async delete(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.air_reading.delete({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async getLatestByStation(stationId) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const readings = await prisma.air_reading.findMany({
        where: { stationId },
        orderBy: { recordedAt: 'desc' },
      });

      if (readings.length === 0) return null;
      
      let aqi = 0;
      let dominant = 'pm25';

      for (const reading of readings) {
        if (reading.pm25 > 0) {
          const pm25Index = subIndex('pm25', reading.pm25);
          if (pm25Index != null && pm25Index > aqi) {
            aqi = pm25Index;
            dominant = 'pm25';
          }
        }
      }

      const latest = readings[0];
      return new AirReading({ ...latest, aqi, dominant });
    } finally {
      await prisma.$disconnect();
    }
  }
}

module.exports = AirReading;
