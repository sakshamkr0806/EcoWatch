// Water Quality Index helpers (weighted method).

const PH_SCALE = [
  { min: 6.5, max: 7.0, score: 10 },
  { min: 6.0, max: 6.5, score: 8 },
  { min: 4.0, max: 6.0, score: 3 },
];

const DO_SCALE = [
  { min: 9, max: 10, score: 90 },
  { min: 7, max: 9, score: 80 },
  { min: 5, max: 7, score: 60 },
  { min: 2, max: 5, score: 30 },
];

const TURBIDITY_SCALE = [
  { min: 0, max: 2, score: 90 },
  { min: 2, max: 5, score: 65 },
  { min: 5, max: 10, score: 50 },
];

const TDS_SCALE = [
  { min: 0, max: 299, score: 80 },
  { min: 300, max: 600, score: 45 },
];

function scorePh(value) {
  const v = Number(value);
  if (v < 4 || v > 10) return null;
  for (const z of PH_SCALE) {
    if (v >= z.min && v <= z.max) return z.score;
  }
  return 3;
}

function scoreDo(value) {
  const v = Number(value);
  if (v < 0 || v > 14) return null;
  for (const z of DO_SCALE) {
    if (v >= z.min && v <= z.max) return z.score;
  }
  return 30;
}

function scoreTurbidity(value) {
  const v = Number(value);
  if (v < 0 || v > 500) return null;
  for (const z of TURBIDITY_SCALE) {
    if (v >= z.min && v <= z.max) return z.score;
  }
  return 50;
}

function scoreTds(value) {
  const v = Number(value);
  if (v < 0 || v > 2000) return null;
  for (const z of TDS_SCALE) {
    if (v >= z.min && v <= z.max) return z.score;
  }
  return 45;
}

function computeWQI(readings) {
  const s = {};
  let wqi = 0;
  if (readings.ph != null && readings.ph > 0) {
    s.ph = scorePh(readings.ph);
    wqi += s.ph * 0.2;
  }
  if (readings.do_ != null && readings.do_ > 0) {
    s.do = scoreDo(readings.do_);
    wqi += s.do * 0.3;
  }
  if (readings.turbidity != null && readings.turbidity > 0) {
    s.turbidity = scoreTurbidity(readings.turbidity);
    wqi += s.turbidity * 0.25;
  }
  if (readings.tds != null && readings.tds > 0) {
    s.tds = scoreTds(readings.tds);
    wqi += s.tds * 0.25;
  }
  return { wqi: Math.round(wqi * 100) / 100, scores: s };
}

function getWQICategory(wqi) {
  const safe = Number(wqi) || 0;
  return [
    { max: 85, label: 'Good', color: '#22c55e' },
    { max: 70, label: 'Satisfactory', color: '#84cc16' },
    { max: 50, label: 'Poor', color: '#d97706' },
    { max: 35, label: 'Very Poor', color: '#dc2626' },
  ].find((z) => safe >= z.max) || null;
}

module.exports = { scorePh, scoreDo, scoreTurbidity, scoreTds, computeWQI, getWQICategory };
