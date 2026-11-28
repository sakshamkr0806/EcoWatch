// Air Quality Index helpers (simplified CPCB / India national AQI method).
// AQI = worst sub-index across pollutants. Each pollutant concentration is
// converted to a 0-500 sub-index by linear interpolation between official
// breakpoints, then the highest sub-index wins and defines the category.

export const AQI_SCALE = [
  {
    label: 'Good',
    min: 0,
    max: 50,
    color: '#16a34a',
    advice: 'Air quality is satisfactory and poses little or no risk. Enjoy your usual outdoor activities.',
  },
  {
    label: 'Satisfactory',
    min: 51,
    max: 100,
    color: '#65a30d',
    advice: 'Air quality is acceptable, though sensitive people may experience minor breathing discomfort.',
  },
  {
    label: 'Moderate',
    min: 101,
    max: 200,
    color: '#d97706',
    advice: 'May cause breathing discomfort for people with lung or heart disease, children and older adults.',
  },
  {
    label: 'Poor',
    min: 201,
    max: 300,
    color: '#dc2626',
    advice: 'Breathing discomfort for most people on prolonged exposure. Limit outdoor exertion.',
  },
  {
    label: 'Very Poor',
    min: 301,
    max: 400,
    color: '#7c3aed',
    advice: 'Respiratory illness even for healthy people on prolonged exposure. Avoid outdoor activity.',
  },
  {
    label: 'Severe',
    min: 401,
    max: 500,
    color: '#7f1d1d',
    advice: 'Serious health impact even for healthy people. Stay indoors and keep windows closed.',
  },
];

// [concentrationLow, concentrationHigh, subIndexLow, subIndexHigh]
const CPCB_BREAKPOINTS = {
  pm25: [
    [0, 30, 0, 50],
    [30, 60, 50, 100],
    [60, 90, 100, 200],
    [90, 120, 200, 300],
    [120, 250, 300, 400],
    [250, 380, 400, 500],
  ],
  pm10: [
    [0, 50, 0, 50],
    [50, 100, 50, 100],
    [100, 250, 100, 200],
    [250, 350, 200, 300],
    [350, 430, 300, 400],
    [430, 510, 400, 500],
  ],
  no2: [
    [0, 40, 0, 50],
    [40, 80, 50, 100],
    [80, 180, 100, 200],
    [180, 280, 200, 300],
    [280, 400, 300, 400],
    [400, 520, 400, 500],
  ],
  so2: [
    [0, 40, 0, 50],
    [40, 80, 50, 100],
    [80, 380, 100, 200],
    [380, 800, 200, 300],
    [800, 1600, 300, 400],
    [1600, 2000, 400, 500],
  ],
};

export const POLLUTANTS = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', limit: 60 },
  pm10: { label: 'PM10', unit: 'µg/m³', limit: 100 },
  no2: { label: 'NO₂', unit: 'µg/m³', limit: 80 },
  so2: { label: 'SO₂', unit: 'µg/m³', limit: 80 },
};

// Convert one pollutant concentration to its 0-500 sub-index.
export function subIndex(pollutant, concentration) {
  const brackets = CPCB_BREAKPOINTS[pollutant];
  if (!brackets || concentration == null || Number.isNaN(Number(concentration))) return null;
  const c = Number(concentration);
  for (const [cLow, cHigh, iLow, iHigh] of brackets) {
    if (c <= cHigh) {
      const ratio = (c - cLow) / (cHigh - cLow || 1);
      return Math.round(iLow + ratio * (iHigh - iLow));
    }
  }
  return 500; // above the highest breakpoint
}

// AQI of a reading = the maximum pollutant sub-index.
export function computeAQI(reading) {
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

export function getAQICategory(aqi) {
  if (aqi == null || (typeof aqi === 'string' && aqi.trim() === '')) {
    return { label: 'Unavailable', min: null, max: null, color: '#64748b', advice: 'AQI is unavailable.' };
  }
  const safe = Number(aqi) || 0;
  return AQI_SCALE.find((z) => safe >= z.min && safe <= z.max) || AQI_SCALE[AQI_SCALE.length - 1];
}

export function getAQIColor(aqi) {
  return getAQICategory(aqi).color;
}

// Gauge zones: cumulative upper limits for each coloured band.
export function aqiZones() {
  return AQI_SCALE.map((z) => ({ limit: z.max, color: z.color }));
}
