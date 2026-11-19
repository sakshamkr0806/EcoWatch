const prisma = require('../config');

async function create(data) {
  return await prisma.air_reading.create({ data });
}

async function findAll() {
  return await prisma.air_reading.findMany();
}

async function findByStationId(stationId) {
  return await prisma.air_reading.findMany({ 
    where: { stationId },
    orderBy: { recordedAt: 'desc' } 
  });
}

async function findById(id) {
  return await prisma.air_reading.findUnique({ where: { id } });
}

async function update(id, data) {
  return await prisma.air_reading.update({ where: { id }, data });
}

async function deleteRead(id) {
  return await prisma.air_reading.delete({ where: { id } });
}

async function getLatest(stationId) {
  const readings = await findByStationId(stationId);
  return readings.length > 0 ? { ...readings[0] } : null;
}

const POLLUTANTS = {
  PM25: { label: 'PM2.5' },
  PM10: { label: 'PM10' },
  NO2: { label: 'NO₂' },
  SO2: { label: 'SO₂' },
};

const aqiZones = () => [
  { limit: 50, category: 'Good' },
  { limit: 100, category: 'Satisfactory' },
  { limit: 200, category: 'Moderate' },
  { limit: 300, category: 'Poor' },
  { limit: 400, category: 'Very Poor' },
  { limit: 500, category: 'Severe' },
];

const subIndex = (pollutant, value) => {
  const limits = {
    PM25: [0, 50, 100, 200, 300, 400],
    PM10: [0, 50, 100, 150, 250, 450],
    NO2: [0, 80, 100, 200, 400, 800],
    SO2: [0, 80, 100, 200, 400, 600],
  };

  const values = {
    PM25: Math.min(Math.max(value || 0, 0), 500),
    PM10: Math.min(Math.max(value || 0, 0), 500),
    NO2: Math.min(Math.max(value || 0, 0), 800),
    SO2: Math.min(Math.max(value || 0, 0), 600),
  };

  const [low, high] = limits[pollutant] || [];
  if (value === 0 && low !== undefined) return 0;
  
  let idx = 0;
  for (let i = 0; i < limits[pollutant].length - 1; i++) {
    if (values[pollutant] > limits[pollutant][i]) idx = i;
    else break;
  }

  const Ilow = limits[pollutant][idx];
  const Ihigh = limits[pollutant][idx + 1];
  
  if (value >= Ilow && value <= Ihigh) {
    return Ilow + ((Ihigh - Ilow) * (value - Ilow)) / (Ihigh - Ilow);
  }

  if (value < low || high === undefined) return 0;
  return Math.min(Ihigh, value);
};

async function computeAQI(pm25, pm10, no2, so2) {
  const [pm25Idx, pm10Idx] = [subIndex('PM25', pm25), subIndex('PM10', pm10)];
  const [no2Idx, so2Idx] = [subIndex('NO2', no2), subIndex('SO2', so2)];

  const indices = {
    PM25: pm25Idx,
    PM10: pm10Idx,
    NO2: no2Idx,
    SO2: so2Idx,
  };

  let maxAQI = Math.max(pm25Idx, pm10Idx, no2Idx, so2Idx) || 0;
  let dominant = 'PM2.5';

  for (const [key, val] of Object.entries(indices)) {
    if (val > maxAQI || (val === maxAQI && key in dominant)) {
      maxAQI = val;
      const pollutantNames = { PM25: 'PM2.5', PM10: 'PM10', NO2: 'NO₂', SO2: 'SO₂' };
      if (maxAQI !== 0) dominant = pollutantNames[key];
    }
  }

  const zone = aqiZones().find(z => maxAQI >= z.limit);
  return { maxAQI: Math.round(maxAQI), dominant };
};

function getAQICategory(aqi) {
  const categories = [0, 50, 100, 200, 300, 400];
  for (let i = 0; i < categories.length - 1; i++) {
    if (Number(aqi) >= categories[i] && Number(aqi) <= categories[i + 1]) {
      return aqiZones()[i].category;
    }
  }
  return 'Severe';
};

module.exports = {
  create,
  findAll,
  findByStationId,
  findById,
  update,
  delete: deleteRead,
  getLatest,
  computeAQI,
  getAQICategory,
};
