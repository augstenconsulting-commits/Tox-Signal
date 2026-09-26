// Date helpers. All event dates are calendar dates (YYYY-MM-DD) handled in UTC
// so that an event never shifts a day because of the viewer's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a YYYY-MM-DD string to a UTC Date. Returns null for invalid input. */
export function parseEventDate(value) {
  if (typeof value !== 'string') return null;
  const m = ISO_DATE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject rollovers such as 2026-02-30.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Parse a full ISO timestamp (retrieval / refresh times). Returns null if invalid. */
export function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Midnight UTC of the given instant. */
export function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whole days from a to b (b - a), both treated as UTC calendar days. */
export function daysBetween(a, b) {
  return Math.round((startOfUtcDay(b) - startOfUtcDay(a)) / DAY_MS);
}

export function addDays(date, n) {
  return new Date(startOfUtcDay(date).getTime() + n * DAY_MS);
}

/** Same day-of-month N months earlier, clamped to month length. */
export function addMonths(date, n) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)));
}

/** "YYYY-MM" key for a UTC date. */
export function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatDate(date) {
  return date ? date.toISOString().slice(0, 10) : '—';
}

export { DAY_MS };
