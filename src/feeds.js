// Feed health. A failed or stale feed is shown with its status and last
// successful refresh; its items are never presented as new.

import { parseTimestamp } from './dates.js';

export const DEFAULT_MAX_AGE_HOURS = 48;
export const NEW_ITEM_DAYS = 7;

/**
 * @param {{id:string,name:string,status:'ok'|'error'|'not_connected',lastSuccessAt?:string,maxAgeHours?:number}} feed
 * @returns {{id, name, state:'current'|'stale'|'error'|'not_connected', lastSuccessAt:Date|null, message:string}}
 */
export function feedHealth(feed, now) {
  const last = parseTimestamp(feed.lastSuccessAt ?? '');
  const maxAge = feed.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  const lastText = last ? last.toISOString() : 'never';
  if (feed.status === 'not_connected') {
    return { id: feed.id, name: feed.name, state: 'not_connected', lastSuccessAt: last, message: 'Not connected — no scheduled refresh.' };
  }
  if (feed.status === 'error') {
    return { id: feed.id, name: feed.name, state: 'error', lastSuccessAt: last, message: `Last refresh failed. Last successful refresh: ${lastText}.` };
  }
  if (!last || (now - last) / 3600000 > maxAge) {
    return { id: feed.id, name: feed.name, state: 'stale', lastSuccessAt: last, message: `Stale. Last successful refresh: ${lastText}.` };
  }
  return { id: feed.id, name: feed.name, state: 'current', lastSuccessAt: last, message: `Current. Last refresh: ${lastText}.` };
}

/** An item is "new" only if recent AND its feed is current. */
export function isNew(event, healthById, now) {
  const recent = (now - event.eventDate) / 86400000 <= NEW_ITEM_DAYS && event.eventDate <= now;
  if (!recent) return false;
  if (!event.feedId) return false;
  return healthById.get(event.feedId)?.state === 'current';
}
