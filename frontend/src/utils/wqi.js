// Water Quality Index helpers.
// Simplified weighted method: each parameter is scored 0-100 against drinking
// water quality norms, then a weighted average produces the WQI (0-100).
// Weights: pH 0.20, DO 0.30, Turbidity 0.25, TDS 0.25.

export const WQI_SCALE = [
  {
    label: 'Excellent',
    min: 90,
    max: 100,
    color: '#0e7490',
    advice: 'Water is of excellent quality and suitable for all intended uses.',
  },
  {
    label: 'Good',
    min: 70,
    max: 89,
    color: '#16a34a',
    advice: 'Water is of good quality. Safe for most uses after routine treatment.',
  },
  {
    label: 'Medium',
    min: 50,
    max: 69,
    color: '#d97706',
    advice: 'Water quality is fair. Treatment is advised before drinking.',
  },
  {
    label: 'Poor',
    min: 25,
    max: 49,
    color: '#dc2626',
    advice: 'Water is polluted. Not suitable for drinking without proper treatment.',
  },
  {
    label: 'Very Poor',
    min: 0,
    max: 24,
    color: '#7f1d1d',
    advice: 'Water is heavily polluted. Avoid all direct contact and use.',
  },
];

export const WATER_PARAMS = {
  ph: { label: 'pH', unit: 'pH', ideal: '6.5 – 8.5', weight: 0.2, note: 'Neutral range for drinking water.' },
  do: { label: 'Dissolved Oxygen', unit: 'mg/L', ideal: '≥ 5 mg/L', weight: 0.3, note: 'Higher is better; below 5 mg/L stresses aquatic life.' },
  turbidity: { label: 'Turbidity', unit: 'NTU', ideal: '< 5 NTU', weight: 0.25, note: 'Cloudiness caused by suspended particles.' },
  tds: { label: 'TDS', unit: 'ppm', ideal: '< 500 ppm', weight: 0.25, note: 'Total dissolved solids such as salts and minerals.' },
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Quality ratings per parameter (0-100, higher = better).
export function scorePh(ph) {
  if (ph == null) return null;
  return clamp(100 - Math.abs(Number(ph) - 7.5) * 25, 0, 100);
}

export function scoreDo(doValue) {
  if (doValue == null) return null;
  return clamp(Number(doValue) * 12.5, 0, 100); // 8 mg/L or more -> 100
}

export function scoreTurbidity(turbidity) {
  if (turbidity == null) return null;
  return clamp(100 - Number(turbidity) * 8, 0, 100); // 0 NTU -> 100
}

export function scoreTds(tds) {
  if (tds == null) return null;
  return clamp(100 - Math.max(0, Number(tds) - 300) * 0.15, 0, 100); // ≤300 ppm -> 100
}

// WQI of a reading = weighted average of the parameter scores.
export function computeWQI(reading) {
  const scores = {
    ph: scorePh(reading?.ph),
    do: scoreDo(reading?.do),
    turbidity: scoreTurbidity(reading?.turbidity),
    tds: scoreTds(reading?.tds),
  };
  let wqi = 0;
  let totalWeight = 0;
  for (const key of Object.keys(WATER_PARAMS)) {
    const s = scores[key];
    if (s != null) {
      wqi += s * WATER_PARAMS[key].weight;
      totalWeight += WATER_PARAMS[key].weight;
    }
  }
  wqi = totalWeight ? Math.round((wqi / totalWeight) * 10) / 10 : 0;
  return { wqi, scores };
}

export function getWQICategory(wqi) {
  if (wqi == null || (typeof wqi === 'string' && wqi.trim() === '')) {
    return { label: 'Unavailable', min: null, max: null, color: '#64748b', advice: 'WQI is unavailable.' };
  }
  const safe = Number(wqi) || 0;
  return WQI_SCALE.find((z) => safe >= z.min && safe <= z.max) || WQI_SCALE[WQI_SCALE.length - 1];
}

export function getWQIColor(wqi) {
  return getWQICategory(wqi).color;
}

// Gauge zones: cumulative upper limits for each coloured band.
export function wqiZones() {
  return WQI_SCALE.map((z) => ({ limit: z.max, color: z.color }));
}
