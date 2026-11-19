const { PrismaClient } = require('../config');
const { computeWQI, scorePh, scoreDo, scoreTurbidity, scoreTds } = require('../utils/wqi');

class WaterReading {
  constructor(data = {}) {
    this.id = data.id || '';
    this.stationId = data.stationId || '';
    this.recordedAt = data.recordedAt || new Date();
    this.ph = data.ph || null;
    this.do_ = data.do || null;
    this.turbidity = data.turbidity || null;
    this.tds = data.tds || null;
    this.wqi = data.wqi || 0;
    this.scores = data.scores || {};
  }

  static async create(data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      let scores = {};
      let wqi = 0;

      if (data.ph != null && data.ph > 0) {
        const phScore = scorePh(data.ph);
        if (phScore !== null) {
          scores.ph = Math.round(phScore * 10) / 10;
          wqi += scores.ph * 0.2;
        }
      }

      if (data.do_ != null && data.do_ > 0) {
        const doScore = scoreDo(data.do_);
        if (doScore !== null) {
          scores.do = Math.round(doScore * 10) / 10;
          wqi += scores.do * 0.3;
        }
      }

      if (data.turbidity != null && data.turbidity > 0) {
        const turbScore = scoreTurbidity(data.turbidity);
        if (turbScore !== null) {
          scores.turbidity = Math.round(turbScore * 10) / 10;
          wqi += scores.turbidity * 0.25;
        }
      }

      if (data.tds != null && data.tds > 0) {
        const tdsScore = scoreTds(data.tds);
        if (tdsScore !== null) {
          scores.tds = Math.round(tdsScore * 10) / 10;
          wqi += scores.tds * 0.25;
        }
      }

      const waterReading = await prisma.water_reading.create({
        data: {
          stationId: data.stationId,
          recordedAt: new Date(data.recordedAt),
          ph: Number(data.ph),
          do_: Number(data.do_),
          turbidity: Number(data.turbidity),
          tds: Number(data.tds),
          wqi: Math.round(wqi * 10) / 10,
          scores,
        },
      });

      return new WaterReading(waterReading);
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findByStationId(stationId) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.water_reading.findMany({ where: { stationId }, orderBy: { recordedAt: 'desc' } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findById(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const reading = await prisma.water_reading.findFirst({ where: { id }, include: { station: true } });
      return reading ? new WaterReading(reading) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async update(id, data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      
      let scores = {};
      let wqi = 0;

      if (data.ph != null && data.ph > 0) {
        const phScore = scorePh(data.ph);
        if (phScore !== null) {
          scores.ph = Math.round(phScore * 10) / 10;
          wqi += scores.ph * 0.2;
        }
      }

      if (data.do_ != null && data.do_ > 0) {
        const doScore = scoreDo(data.do_);
        if (doScore !== null) {
          scores.do = Math.round(doScore * 10) / 10;
          wqi += scores.do * 0.3;
        }
      }

      if (data.turbidity != null && data.turbidity > 0) {
        const turbScore = scoreTurbidity(data.turbidity);
        if (turbScore !== null) {
          scores.turbidity = Math.round(turbScore * 10) / 10;
          wqi += scores.turbidity * 0.25;
        }
      }

      if (data.tds != null && data.tds > 0) {
        const tdsScore = scoreTds(data.tds);
        if (tdsScore !== null) {
          scores.tds = Math.round(tdsScore * 10) / 10;
          wqi += scores.tds * 0.25;
        }
      }

      return await prisma.water_reading.update({ 
        where: { id }, 
        data: { ...data, wqi: Math.round(wqi * 10) / 10, scores } 
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async delete(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.water_reading.delete({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async getLatestByStation(stationId) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const readings = await prisma.water_reading.findMany({
        where: { stationId },
        orderBy: { recordedAt: 'desc' },
      });

      if (readings.length === 0) return null;
      
      let scores = {};
      let wqi = 0;

      if (readings[0].ph != null && readings[0].ph > 0) {
        const phScore = scorePh(readings[0].ph);
        if (phScore !== null) {
          scores.ph = Math.round(phScore * 10) / 10;
          wqi += scores.ph * 0.2;
        }
      }

      if (readings[0].do_ != null && readings[0].do_ > 0) {
        const doScore = scoreDo(readings[0].do_);
        if (doScore !== null) {
          scores.do = Math.round(doScore * 10) / 10;
          wqi += scores.do * 0.3;
        }
      }

      if (readings[0].turbidity != null && readings[0].turbidity > 0) {
        const turbScore = scoreTurbidity(readings[0].turbidity);
        if (turbScore !== null) {
          scores.turbidity = Math.round(turbScore * 10) / 10;
          wqi += scores.turbidity * 0.25;
        }
      }

      if (readings[0].tds != null && readings[0].tds > 0) {
        const tdsScore = scoreTds(readings[0].tds);
        if (tdsScore !== null) {
          scores.tds = Math.round(tdsScore * 10) / 10;
          wqi += scores.tds * 0.25;
        }
      }

      const latest = readings[0];
      return new WaterReading({ ...latest, wqi: Math.round(wqi * 10) / 10, scores });
    } finally {
      await prisma.$disconnect();
    }
  }
}

module.exports = WaterReading;
