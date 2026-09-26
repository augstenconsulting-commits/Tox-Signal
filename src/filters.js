// Time-window, category, and priority filtering.

import { addDays, addMonths, startOfUtcDay } from './dates.js';

export const WINDOWS = {
  '30d': { label: '30 days' },
  '90d': { label: '90 days' },
  '12m': { label: '12 months' },
  all: { label: 'All history' },
};

/** Inclusive UTC start date for a window, or null for all history. */
export function windowStart(windowKey, now) {
  const today = startOfUtcDay(now);
  switch (windowKey) {
    case '30d':
      return addDays(today, -29);
    case '90d':
      return addDays(today, -89);
    case '12m':
      return addDays(addMonths(today, -12), 1);
    case 'all':
      return null;
    default:
      throw new Error(`unknown window "${windowKey}"`);
  }
}

/** Length in days of a window (inclusive of today). null for all history. */
export function windowLengthDays(windowKey, now) {
  const start = windowStart(windowKey, now);
  if (!start) return null;
  return Math.round((startOfUtcDay(now) - start) / 86400000) + 1;
}

/**
 * Filter events.
 * @param {object[]} events normalized events
 * @param {{window?:string, categories?:string[], priorities?:string[], reviewStates?:string[], now:Date}} opts
 *   Empty/absent category or priority lists mean "all".
 */
export function filterEvents(events, opts) {
  const { window = 'all', categories = [], priorities = [], reviewStates = ['approved'], now } = opts;
  if (!(now instanceof Date)) throw new Error('filterEvents requires a "now" Date');
  const start = windowStart(window, now);
  const end = startOfUtcDay(now);
  return events.filter((e) => {
    if (start && e.eventDate < start) return false;
    if (e.eventDate > end) return false; // future-dated items are not "recent"
    if (categories.length && !categories.includes(e.category)) return false;
    if (priorities.length && !priorities.includes(e.priority)) return false;
    if (reviewStates.length && !reviewStates.includes(e.reviewState)) return false;
    return true;
  });
}

const PRIORITY_RANK = { High: 0, Medium: 1, Watch: 2 };

/** Sort: priority (High first), then most recent event date. */
export function sortForBoard(events) {
  return [...events].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.eventDate - a.eventDate,
  );
}

/** Sort: most recent first. */
export function sortForLedger(events) {
  return [...events].sort((a, b) => b.eventDate - a.eventDate || a.id.localeCompare(b.id));
}
