import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseEventDate, addMonths, formatDate } from '../src/dates.js';
import { normalizeEvent, normalizeEvents } from '../src/model.js';
import { filterEvents, windowStart, windowLengthDays, sortForBoard } from '../src/filters.js';
import { computeSignalIndex, describeIndex, INDEX_LABEL, INDEX_DISCLAIMER } from '../src/signal-index.js';
import { monthlyTrend } from '../src/trend.js';
import { reviewQueue, decide, publicView } from '../src/review.js';
import { feedHealth, isNew } from '../src/feeds.js';

const NOW = new Date('2026-09-25T12:00:00Z');

function ev(overrides = {}) {
  const { event, errors } = normalizeEvent({
    id: 'E1', title: 't', category: 'Opioids', priority: 'High',
    sourceUrl: 'https://example.org/x', sourceOrganization: 'Sample', feedId: 'a',
    eventDate: '2026-09-20', retrievedAt: '2026-09-21T00:00:00Z', reviewState: 'approved',
    ...overrides,
  });
  assert.deepEqual(errors, []);
  return event;
}

// ---- dates
test('parseEventDate is UTC and rejects rollovers/bad formats', () => {
  assert.equal(parseEventDate('2026-03-01').toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(parseEventDate('2026-02-30'), null);
  assert.equal(parseEventDate('03/01/2026'), null);
  assert.equal(parseEventDate(undefined), null);
});

test('addMonths clamps to month end', () => {
  assert.equal(formatDate(addMonths(parseEventDate('2026-03-31'), -1)), '2026-02-28');
});

// ---- normalization
test('normalizeEvent requires provenance fields and defaults to pending review', () => {
  const { event, errors } = normalizeEvent({ id: 'x', title: 't', category: 'Opioids', priority: 'High' });
  assert.equal(event, null);
  for (const f of ['sourceUrl', 'sourceOrganization', 'eventDate', 'retrievedAt']) {
    assert.ok(errors.includes(`missing ${f}`), f);
  }
  const ok = ev({ reviewState: undefined });
  assert.equal(ok.reviewState, 'pending_review');
});

test('normalizeEvent rejects unknown priority/category and non-http URLs', () => {
  const r = normalizeEvent({ id: 'x', title: 't', category: 'Nope', priority: 'Urgent', sourceUrl: 'javascript:alert(1)',
    sourceOrganization: 'o', eventDate: '2026-01-01', retrievedAt: '2026-01-02T00:00:00Z' });
  assert.equal(r.event, null);
  assert.ok(r.errors.some((e) => e.startsWith('unknown category')));
  assert.ok(r.errors.some((e) => e.startsWith('unknown priority')));
  assert.ok(r.errors.some((e) => e.startsWith('invalid sourceUrl')));
});

// ---- filters
test('window starts are inclusive and correct length', () => {
  assert.equal(formatDate(windowStart('30d', NOW)), '2026-08-27');
  assert.equal(windowLengthDays('30d', NOW), 30);
  assert.equal(windowLengthDays('90d', NOW), 90);
  assert.equal(formatDate(windowStart('12m', NOW)), '2025-09-26');
  assert.equal(windowStart('all', NOW), null);
  assert.throws(() => windowStart('7d', NOW));
});

test('filterEvents applies window, category, priority, review state, and excludes future dates', () => {
  const events = [
    ev({ id: 'in', eventDate: '2026-08-27' }),
    ev({ id: 'edge-out', eventDate: '2026-08-26' }),
    ev({ id: 'future', eventDate: '2026-09-26' }),
    ev({ id: 'stim', category: 'Stimulants' }),
    ev({ id: 'watch', priority: 'Watch' }),
    ev({ id: 'pending', reviewState: 'pending_review' }),
  ];
  const ids = (o) => filterEvents(events, { now: NOW, ...o }).map((e) => e.id).sort();
  assert.deepEqual(ids({ window: '30d' }), ['in', 'stim', 'watch']);
  assert.deepEqual(ids({ window: '30d', categories: ['Stimulants'] }), ['stim']);
  assert.deepEqual(ids({ window: '30d', priorities: ['Watch'] }), ['watch']);
  assert.ok(!ids({ window: 'all' }).includes('pending'));
  assert.throws(() => filterEvents(events, {}));
});

test('sortForBoard orders High > Medium > Watch then newest', () => {
  const s = sortForBoard([ev({ id: 'w', priority: 'Watch' }), ev({ id: 'h1', eventDate: '2026-09-01' }), ev({ id: 'm', priority: 'Medium' }), ev({ id: 'h2' })]);
  assert.deepEqual(s.map((e) => e.id), ['h2', 'h1', 'm', 'w']);
});

// ---- signal index
test('signal index = 100 when recent rate equals baseline rate, and is labeled', () => {
  const events = [];
  // one item every 10 days for 390 days before now
  for (let d = 0; d < 390; d += 10) {
    const date = new Date(NOW.getTime() - d * 86400000).toISOString().slice(0, 10);
    events.push(ev({ id: `e${d}`, eventDate: date }));
  }
  const r = computeSignalIndex(events, { window: '90d', now: NOW });
  assert.equal(r.status, 'ok');
  assert.ok(Math.abs(r.value - 100) <= 12, `value ${r.value}`);
  assert.equal(r.label, INDEX_LABEL);
  assert.match(r.disclaimer, /not a prevalence estimate/);
  assert.match(describeIndex(r), /Relative signal index/);
  assert.doesNotMatch(describeIndex(r), /prevalence|probability|risk of/i);
});

test('signal index withholds a value when the baseline is too thin', () => {
  const r = computeSignalIndex([ev({ eventDate: '2026-09-01' })], { window: '30d', now: NOW });
  assert.equal(r.value, null);
  assert.equal(r.status, 'insufficient_baseline');
  assert.match(describeIndex(r), /insufficient baseline/);
});

test('signal index flags sample data in its description', () => {
  const r = computeSignalIndex([ev({ isSample: true })], { window: 'all', now: NOW });
  assert.match(describeIndex(r), /^\[SAMPLE DATA\]/);
});

// ---- trend
test('monthlyTrend returns 12 buckets ending in the current month', () => {
  const t = monthlyTrend([ev({ eventDate: '2026-09-01' }), ev({ eventDate: '2025-10-31' }), ev({ eventDate: '2025-09-30' })], NOW);
  assert.equal(t.length, 12);
  assert.equal(t[0].month, '2025-10');
  assert.equal(t[11].month, '2026-09');
  assert.equal(t[0].count, 1);
  assert.equal(t[11].count, 1);
});

// ---- review
test('pending items hide interpretation; decide requires a named reviewer', () => {
  const p = ev({ reviewState: 'pending_review', clinicalInterpretation: 'X', forensicImplication: 'Y', observation: 'O' });
  assert.deepEqual(reviewQueue([p, ev()]).map((e) => e.id), ['E1']);
  const v = publicView(p);
  assert.equal(v.observation, 'O');
  assert.doesNotMatch(v.clinicalInterpretation, /X/);
  assert.doesNotMatch(v.forensicImplication, /Y/);
  assert.throws(() => decide(p, 'approved', ''));
  const a = decide(p, 'approved', 'A. Augsten');
  assert.equal(publicView(a).clinicalInterpretation, 'X');
  assert.equal(p.reviewState, 'pending_review'); // not mutated
});

// ---- feeds
test('feed health distinguishes current, stale, error, not connected', () => {
  assert.equal(feedHealth({ id: 'a', name: 'A', status: 'ok', lastSuccessAt: '2026-09-25T00:00:00Z' }, NOW).state, 'current');
  assert.equal(feedHealth({ id: 'a', name: 'A', status: 'ok', lastSuccessAt: '2026-09-20T00:00:00Z' }, NOW).state, 'stale');
  const err = feedHealth({ id: 'a', name: 'A', status: 'error', lastSuccessAt: '2026-09-24T00:00:00Z' }, NOW);
  assert.equal(err.state, 'error');
  assert.match(err.message, /2026-09-24/);
  assert.equal(feedHealth({ id: 'a', name: 'A', status: 'not_connected' }, NOW).state, 'not_connected');
});

test('items from a stale feed are never marked new', () => {
  const health = new Map([
    ['a', { state: 'current' }],
    ['b', { state: 'stale' }],
  ]);
  assert.equal(isNew(ev({ feedId: 'a', eventDate: '2026-09-24' }), health, NOW), true);
  assert.equal(isNew(ev({ feedId: 'b', eventDate: '2026-09-24' }), health, NOW), false);
  assert.equal(isNew(ev({ feedId: 'a', eventDate: '2026-08-01' }), health, NOW), false);
});

// ---- sample data integrity
test('sample data is fully labeled as synthetic and valid', async () => {
  const raw = JSON.parse(await readFile(new URL('../data/sample-events.json', import.meta.url)));
  assert.equal(raw.isSample, true);
  assert.match(raw.notice, /SYNTHETIC/);
  const { events, rejected } = normalizeEvents(raw.events);
  assert.deepEqual(rejected, []);
  for (const e of events) {
    assert.equal(e.isSample, true, e.id);
    assert.match(e.sourceOrganization, /SAMPLE/);
    assert.match(e.sourceUrl, /^https:\/\/example\.org\//); // never a fake link to a real agency
  }
  assert.ok(events.some((e) => e.reviewState === 'pending_review'));
});
