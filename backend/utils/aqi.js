const POLLUTANTS = {
  PM25: { label: 'PM2.5' },
  PM10: { label: 'PM10' },
  NO2: { label: 'NO₂' },
  SO2: { label: 'SO₂' },
};

const aqiZones = () => [
  { limit: 50, category: 'Good', color: '#00E400' },
  { limit: 100, category: 'Satisfactory', color: '#E6CC80' },
  { limit: 200, category: 'Moderate', color: '#FF7E00' },
  { limit: 300, category: 'Poor', color: '#FF0000' },
  { limit: 400, category: 'Very Poor', color: '#963239' },
  { limit: 500, category: 'Severe', color: '#7E1A33' },
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

  const [low, high] = limits[pollutant];
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

const computeAQI = (pm25, pm10, no2, so2) => {
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

  const category = aqiZones().find(z => maxAQI >= z.limit)?.category || 'Severe';
  
  return { maxAQI: Math.round(maxAQI), dominant, category };
};

module.exports = {
  subIndex,
  computeAQI,
  aqiZones,
  POLLUTANTS,
};
