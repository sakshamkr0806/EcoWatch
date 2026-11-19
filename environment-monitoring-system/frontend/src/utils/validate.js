// Shared parameter metadata + validation rules used by the measurement form.
// (The backend will re-validate everything; this gives instant feedback.)

export const PARAM_LIMITS = {
  pm25: { label: 'PM2.5', min: 0, max: 800, unit: 'µg/m³', type: 'AIR' },
  pm10: { label: 'PM10', min: 0, max: 1200, unit: 'µg/m³', type: 'AIR' },
  no2: { label: 'NO₂', min: 0, max: 600, unit: 'µg/m³', type: 'AIR' },
  so2: { label: 'SO₂', min: 0, max: 1600, unit: 'µg/m³', type: 'AIR' },
  ph: { label: 'pH', min: 0, max: 14, unit: 'pH', type: 'WATER' },
  do: { label: 'Dissolved Oxygen', min: 0, max: 20, unit: 'mg/L', type: 'WATER' },
  turbidity: { label: 'Turbidity', min: 0, max: 100, unit: 'NTU', type: 'WATER' },
  tds: { label: 'TDS', min: 0, max: 3000, unit: 'ppm', type: 'WATER' },
};

export const AIR_PARAMS = ['pm25', 'pm10', 'no2', 'so2'];
export const WATER_PARAMS_KEYS = ['ph', 'do', 'turbidity', 'tds'];

export function paramsForStationType(type) {
  if (type === 'AIR') return AIR_PARAMS;
  if (type === 'WATER') return WATER_PARAMS_KEYS;
  return [...AIR_PARAMS, ...WATER_PARAMS_KEYS]; // BOTH
}

// Returns an error message string, or null when the value is valid.
export function validateValue(parameter, rawValue) {
  const meta = PARAM_LIMITS[parameter];
  if (!meta) return 'Unknown parameter.';
  const value = Number(rawValue);
  if (rawValue === '' || rawValue == null || Number.isNaN(value)) {
    return 'Please enter a numeric value.';
  }
  if (value < meta.min || value > meta.max) {
    return `${meta.label} must be between ${meta.min} and ${meta.max} ${meta.unit}.`;
  }
  return null;
}
