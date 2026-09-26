// Deviation-from-baseline index.
//
// This is a RELATIVE SIGNAL INDEX: the rate of reviewed signal items in a
// recent window divided by the rate in the preceding history, scaled so the
// historical baseline = 100. It says "more or fewer alerts/surveillance items
// than usual". It is NOT a prevalence estimate, incidence, exposure count, or
// an individual risk probability, and must always be displayed with that label.

import { startOfUtcDay } from './dates.js';
import { windowStart } from './filters.js';

export const INDEX_LABEL = 'Relative signal index (historical baseline = 100)';
export const INDEX_DISCLAIMER =
  'Compares the rate of reviewed alert and surveillance items with this category’s own history. ' +
  'It is not a prevalence estimate, incidence rate, exposure count, or individual risk probability.';

/** Minimum baseline days and items before an index is reported. */
export const MIN_BASELINE_DAYS = 90;
export const MIN_BASELINE_ITEMS = 3;

/**
 * Compute the index for one set of events (usually a single category).
 * @returns {{value:number|null, status:'ok'|'insufficient_baseline'|'all_history', recentCount:number, baselineCount:number, label:string, disclaimer:string, isSample:boolean}}
 */
export function computeSignalIndex(events, { window, now }) {
  const base = { label: INDEX_LABEL, disclaimer: INDEX_DISCLAIMER };
  const isSample = events.some((e) => e.isSample);
  if (window === 'all') {
    return { ...base, value: null, status: 'all_history', recentCount: events.length, baselineCount: 0, isSample };
  }
  const today = startOfUtcDay(now);
  const start = windowStart(window, now);
  const recentDays = Math.round((today - start) / 86400000) + 1;

  const recent = events.filter((e) => e.eventDate >= start && e.eventDate <= today);
  const history = events.filter((e) => e.eventDate < start);
  const earliest = history.reduce((min, e) => (min === null || e.eventDate < min ? e.eventDate : min), null);
  const baselineDays = earliest ? Math.round((start - earliest) / 86400000) : 0;

  if (baselineDays < MIN_BASELINE_DAYS || history.length < MIN_BASELINE_ITEMS) {
    return {
      ...base,
      value: null,
      status: 'insufficient_baseline',
      recentCount: recent.length,
      baselineCount: history.length,
      isSample,
    };
  }

  const recentRate = recent.length / recentDays;
  const baselineRate = history.length / baselineDays;
  const value = Math.round((recentRate / baselineRate) * 100);
  return { ...base, value, status: 'ok', recentCount: recent.length, baselineCount: history.length, isSample };
}

/** Human-readable text for an index result. Always carries the label. */
export function describeIndex(result) {
  const prefix = result.isSample ? '[SAMPLE DATA] ' : '';
  if (result.status === 'all_history') return `${prefix}${INDEX_LABEL}: not applicable to all-history view`;
  if (result.status === 'insufficient_baseline') return `${prefix}${INDEX_LABEL}: insufficient baseline`;
  return `${prefix}${INDEX_LABEL}: ${result.value}`;
}
