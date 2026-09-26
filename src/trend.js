// 12-month activity trend: count of reviewed items per calendar month.

import { monthKey } from './dates.js';

/** Returns 12 { month:'YYYY-MM', count } buckets ending with the month of `now`. */
export function monthlyTrend(events, now, months = 12) {
  const buckets = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  for (let i = months - 1; i >= 0; i--) {
    buckets.push({ month: monthKey(new Date(Date.UTC(y, m - i, 1))), count: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of events) {
    const i = index.get(monthKey(e.eventDate));
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets;
}
