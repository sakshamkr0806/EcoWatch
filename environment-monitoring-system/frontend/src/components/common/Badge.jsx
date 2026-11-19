// Coloured pill label. Variant keys map to CSS classes in global.css.
const VARIANTS = {
  green: 'b-green',
  lime: 'b-lime',
  cyan: 'b-cyan',
  blue: 'b-blue',
  amber: 'b-amber',
  orange: 'b-orange',
  red: 'b-red',
  purple: 'b-purple',
  maroon: 'b-maroon',
  gray: 'b-gray',
};

export default function Badge({ variant = 'gray', children }) {
  return <span className={`badge ${VARIANTS[variant] || VARIANTS.gray}`}>{children}</span>;
}

// ---- shared mapping helpers used by several pages ----
export const severityVariant = (severity) =>
  ({ LOW: 'gray', MODERATE: 'amber', HIGH: 'red', CRITICAL: 'maroon' }[severity] || 'gray');

export const statusVariant = (status) =>
  ({ ACTIVE: 'green', MAINTENANCE: 'amber', INACTIVE: 'gray', OPEN: 'red', ACKNOWLEDGED: 'amber', RESOLVED: 'green', VALIDATED: 'green', 'AUTO-LOGGED': 'gray' }[status] || 'gray');

export const typeVariant = (type) => ({ AIR: 'blue', WATER: 'cyan', BOTH: 'purple' }[type] || 'gray');
