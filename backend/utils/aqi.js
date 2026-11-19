// Air Quality Index helpers (simplified CPCB / India national AQI method).

const AQI_SCALE = [
  { label: 'Good', min: 0, max: 50, color: '#16a34a' },
  { label: 'Satisfactory', min: 51, max: 100, color: '#65a30d' },
  { label: 'Moderate', min: 101, max: 200, color: '#d97706' },
  { label: 'Poor', min: 201, max: 300, color: '#dc2626' },
  { label: 'Very Poor', min: 301, max: 400, color: '#7c3aed' },
  { label: 'Severe', min: 401, max: 500, color: '#7f1d1d' },
];

const CPCB_BREAKPOINTS = {
  pm25: [
    [0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200],
    [90, 120, 200, 300], [120, 250, 300, 400], [250, 380, 400, 500],
  ],
  pm10: [
    [0, 50, 0, 50], [50, 100, 50, 100], [100, 250, 100, 200],
    [250, 350, 200, 300], [350, 430, 300, 400], [430, 510, 400, 500],
  ],
  no2: [
    [0, 40, 0, 50], [40, 80, 50, 100], [80, 180, 100, 200],
    [180, 280, 200, 300], [280, 400, 300, 400], [400, 520, 400, 500],
  ],
  so2: [
    [0, 40, 0, 50], [40, 80, 50, 100], [80, 380, 100, 200],
    [380, 800, 200, 300], [800, 1600, 300, 400], [1600, 2000, 400, 500],
  ],
};

const POLLUTANTS = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', limit: 60 },
  pm10: { label: 'PM10', unit: 'µg/m³', limit: 100 },
  no2: { label: 'NO₂', unit: 'µg/m³', limit: 80 },
  so2: { label: 'SO₂', unit: 'µg/m³', limit: 80 },
};

function subIndex(pollutant, concentration) {
  const brackets = CPCB_BREAKPOINTS[pollutant];
  if (!brackets || concentration == null || Number.isNaN(Number(concentration))) return null;
  const c = Number(concentration);
  for (const [cLow, cHigh, iLow, iHigh] of brackets) {
    if (c <= cHigh) {
      const ratio = (c - cLow) / (cHigh - cLow || 1);
      return Math.round(iLow + ratio * (iHigh - iLow));
    }
  }
  return 500;
}

function computeAQI(reading) {
  let aqi = 0;
  let dominant = 'pm25';
  for (const key of Object.keys(CPCB_BREAKPOINTS)) {
    const si = subIndex(key, reading?.[key]);
    if (si != null && si > aqi) {
      aqi = si;
      dominant = key;
    }
  }
  return { aqi, dominant };
}

function getAQICategory(aqi) {
  const safe = Number(aqi) || 0;
  return AQI_SCALE.find((z) => safe >= z.min && safe <= z.max) || AQI_SCALE[AQI_SCALE.length - 1];
}

function getAQIColor(aqi) {
  return getAQICategory(aqi).color;
}

function aqiZones() {
  return AQI_SCALE.map((z) => ({ limit: z.max, color: z.color }));
}

module.exports = { AQI_SCALE, POLLUTANTS, subIndex, computeAQI, getAQICategory, getAQIColor, aqiZones };
