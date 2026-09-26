// Event model and normalization.
// Every event must carry: source URL, source organization, event date,
// retrieval time, and review state. Source observation, clinical
// interpretation, forensic/legal implication, and uncertainty are kept as
// separate fields and are never merged into one text blob.

import { parseEventDate, parseTimestamp } from './dates.js';

export const CATEGORIES = [
  'Opioids',
  'Stimulants',
  'Sedatives & adulterants',
  'Novel psychoactive substances',
  'Product safety',
];

export const PRIORITIES = ['High', 'Medium', 'Watch'];

export const REVIEW_STATES = ['pending_review', 'approved', 'rejected'];

const REQUIRED = ['id', 'title', 'sourceUrl', 'sourceOrganization', 'eventDate', 'retrievedAt'];

/**
 * Normalize a raw event record. Returns { event, errors }.
 * Invalid records are returned with errors so ingestion can report them
 * rather than silently dropping or guessing values.
 */
export function normalizeEvent(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { event: null, errors: ['record is not an object'] };
  }
  for (const key of REQUIRED) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === '') {
      errors.push(`missing ${key}`);
    }
  }

  const eventDate = parseEventDate(raw.eventDate);
  if (raw.eventDate && !eventDate) errors.push(`invalid eventDate "${raw.eventDate}"`);

  const retrievedAt = parseTimestamp(raw.retrievedAt);
  if (raw.retrievedAt && !retrievedAt) errors.push(`invalid retrievedAt "${raw.retrievedAt}"`);

  let sourceUrl = null;
  try {
    const u = new URL(raw.sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
    sourceUrl = u.toString();
  } catch {
    if (raw.sourceUrl) errors.push(`invalid sourceUrl "${raw.sourceUrl}"`);
  }

  const category = CATEGORIES.includes(raw.category) ? raw.category : null;
  if (!category) errors.push(`unknown category "${raw.category}"`);

  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : null;
  if (!priority) errors.push(`unknown priority "${raw.priority}"`);

  // Anything that did not come through human review lands in the queue.
  const reviewState = REVIEW_STATES.includes(raw.reviewState) ? raw.reviewState : 'pending_review';

  const event = {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    category,
    priority,
    sourceUrl,
    sourceOrganization: String(raw.sourceOrganization ?? ''),
    feedId: raw.feedId ? String(raw.feedId) : null,
    eventDate,
    retrievedAt,
    reviewState,
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy) : null,
    automated: raw.automated !== false,
    isSample: raw.isSample === true,
    // Kept distinct on purpose.
    observation: String(raw.observation ?? ''),
    clinicalInterpretation: String(raw.clinicalInterpretation ?? ''),
    forensicImplication: String(raw.forensicImplication ?? ''),
    uncertainty: String(raw.uncertainty ?? ''),
  };

  return { event: errors.length ? null : event, errors };
}

/** Normalize a list; returns valid events plus a per-record error report. */
export function normalizeEvents(rawList) {
  const events = [];
  const rejected = [];
  (Array.isArray(rawList) ? rawList : []).forEach((raw, i) => {
    const { event, errors } = normalizeEvent(raw);
    if (event) events.push(event);
    else rejected.push({ index: i, id: raw?.id ?? null, errors });
  });
  return { events, rejected };
}
