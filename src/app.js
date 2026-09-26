// Display layer. Pure logic lives in the other modules; this file only renders.

import { normalizeEvents, CATEGORIES, PRIORITIES } from './model.js';
import { filterEvents, sortForBoard, sortForLedger, WINDOWS } from './filters.js';
import { computeSignalIndex, describeIndex, INDEX_LABEL, INDEX_DISCLAIMER } from './signal-index.js';
import { monthlyTrend } from './trend.js';
import { reviewQueue, publicView } from './review.js';
import { feedHealth, isNew } from './feeds.js';
import { formatDate, parseTimestamp } from './dates.js';

const state = { window: '90d', categories: [], priorities: [], selectedId: null };
let data = null;

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function load() {
  const res = await fetch('data/sample-events.json', { cache: 'no-store' });
  const raw = await res.json();
  const { events, rejected } = normalizeEvents(raw.events);
  // Sample data is evaluated as of its own date so it does not silently age into "old".
  const now = raw.isSample ? parseTimestamp(raw.asOf) : new Date();
  const health = raw.feeds.map((f) => feedHealth(f, now));
  data = { raw, events, rejected, now, health, healthById: new Map(health.map((h) => [h.id, h])) };
  buildControls();
  render();
}

function buildControls() {
  $('#windows').innerHTML = Object.entries(WINDOWS)
    .map(([k, w]) => `<button data-window="${k}" aria-pressed="${k === state.window}">${w.label}</button>`)
    .join('');
  $('#categories').innerHTML = CATEGORIES.map(
    (c) => `<label><input type="checkbox" data-cat="${esc(c)}"> ${esc(c)}</label>`,
  ).join('');
  $('#priorities').innerHTML = PRIORITIES.map(
    (p) => `<label><input type="checkbox" data-pri="${p}"> <span class="pill ${p.toLowerCase()}">${p}</span></label>`,
  ).join('');

  $('#windows').addEventListener('click', (e) => {
    const k = e.target.dataset.window;
    if (!k) return;
    state.window = k;
    document.querySelectorAll('#windows button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.window === k));
    render();
  });
  $('#categories').addEventListener('change', () => {
    state.categories = [...document.querySelectorAll('[data-cat]:checked')].map((i) => i.dataset.cat);
    render();
  });
  $('#priorities').addEventListener('change', () => {
    state.priorities = [...document.querySelectorAll('[data-pri]:checked')].map((i) => i.dataset.pri);
    render();
  });
  document.body.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) {
      state.selectedId = row.dataset.id;
      render();
    }
  });
}

function render() {
  const { events, now, raw, health, healthById } = data;
  const approved = events.filter((e) => e.reviewState === 'approved');
  const visible = filterEvents(events, { ...state, now });

  $('#sample-banner').hidden = !raw.isSample;
  $('#sample-banner').textContent = raw.notice ?? '';
  $('#asof').textContent = `As of ${formatDate(now)}`;

  // Feed status
  $('#feeds').innerHTML = health
    .map((h) => `<li class="feed ${h.state}"><strong>${esc(h.name)}</strong> <span>${esc(h.message)}</span></li>`)
    .join('');

  // Priority board: signal index per category (respects category filter)
  const cats = state.categories.length ? state.categories : CATEGORIES;
  $('#board').innerHTML = cats
    .map((c) => {
      const inCat = approved.filter((e) => e.category === c);
      const idx = computeSignalIndex(inCat, { window: state.window, now });
      const top = sortForBoard(visible.filter((e) => e.category === c))[0];
      const val = idx.status === 'ok' ? idx.value : '—';
      const note =
        idx.status === 'insufficient_baseline' ? 'Insufficient baseline' : idx.status === 'all_history' ? 'Not applicable' : `${idx.recentCount} recent vs. ${idx.baselineCount} prior items`;
      return `<article class="card" title="${esc(describeIndex(idx))}">
        <h3>${esc(c)}</h3>
        <div class="index ${idx.status === 'ok' && idx.value >= 150 ? 'up' : ''}">${val}</div>
        <div class="muted small">${esc(note)}</div>
        ${top ? `<div class="small">Top: <span class="pill ${top.priority.toLowerCase()}">${top.priority}</span> ${esc(top.title)}</div>` : '<div class="small muted">No items in window</div>'}
      </article>`;
    })
    .join('');
  $('#index-label').textContent = `${raw.isSample ? '[SAMPLE] ' : ''}${INDEX_LABEL}`;
  $('#index-disclaimer').textContent = INDEX_DISCLAIMER;

  // Ledger
  const ledger = sortForLedger(visible);
  $('#ledger-count').textContent = `${ledger.length} reviewed item${ledger.length === 1 ? '' : 's'}`;
  $('#ledger').innerHTML =
    ledger
      .map(
        (e) => `<tr data-id="${esc(e.id)}" class="${e.id === state.selectedId ? 'selected' : ''}">
        <td>${formatDate(e.eventDate)}${isNew(e, healthById, now) ? ' <span class="new">NEW</span>' : ''}</td>
        <td><span class="pill ${e.priority.toLowerCase()}">${e.priority}</span></td>
        <td>${esc(e.category)}</td>
        <td>${esc(e.title)}</td>
        <td><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceOrganization)}</a></td>
      </tr>`,
      )
      .join('') || '<tr><td colspan="5" class="muted">No reviewed items match these filters.</td></tr>';

  // Detail + historical context
  const sel = events.find((e) => e.id === state.selectedId);
  if (sel) {
    const v = publicView(sel);
    const catHistory = approved.filter((e) => e.category === sel.category && e.eventDate < sel.eventDate);
    const feed = healthById.get(sel.feedId);
    $('#detail').innerHTML = `
      <h3>${esc(sel.title)}</h3>
      <p class="small">${esc(sel.id)} · Event date ${formatDate(sel.eventDate)} · Retrieved ${esc(sel.retrievedAt.toISOString())} · Review: ${esc(sel.reviewState)}${sel.reviewedBy ? ` by ${esc(sel.reviewedBy)}` : ''}</p>
      <p class="small">Source: <a href="${esc(sel.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(sel.sourceOrganization)}</a>${feed ? ` · Feed: ${esc(feed.name)} (${esc(feed.state)})` : ''}</p>
      <dl>
        <dt>Source observation</dt><dd>${esc(v.observation)}</dd>
        <dt>Clinical interpretation</dt><dd>${esc(v.clinicalInterpretation)}</dd>
        <dt>Forensic / legal implication</dt><dd>${esc(v.forensicImplication)}</dd>
        <dt>Uncertainty</dt><dd>${esc(v.uncertainty)}</dd>
        <dt>Historical context</dt><dd>${catHistory.length} earlier reviewed item(s) in ${esc(sel.category)}${catHistory.length ? `, most recent ${formatDate(catHistory.at(-1).eventDate)}` : ''}.</dd>
      </dl>`;
  } else {
    $('#detail').innerHTML = '<p class="muted">Select an item in the ledger or review queue.</p>';
  }

  // Trend (reviewed items; honors category/priority filters, always 12 months)
  const trendEvents = filterEvents(events, { ...state, window: '12m', now });
  const trend = monthlyTrend(trendEvents, now);
  const max = Math.max(1, ...trend.map((b) => b.count));
  $('#trend').innerHTML = trend
    .map(
      (b) => `<div class="bar" title="${b.month}: ${b.count}">
        <span style="height:${(b.count / max) * 100}%"></span><em>${b.month.slice(5)}</em><b>${b.count}</b></div>`,
    )
    .join('');

  // Review queue
  const queue = reviewQueue(events);
  $('#queue-count').textContent = String(queue.length);
  $('#queue').innerHTML =
    queue
      .map(
        (e) => `<li data-id="${esc(e.id)}"><span class="pill ${e.priority.toLowerCase()}">${e.priority}</span> ${esc(e.title)}
        <span class="muted small">retrieved ${esc(e.retrievedAt.toISOString().slice(0, 16))}Z</span></li>`,
      )
      .join('') || '<li class="muted">Queue empty.</li>';

  if (data.rejected.length) {
    $('#rejected').hidden = false;
    $('#rejected').textContent = `${data.rejected.length} record(s) failed validation and were not displayed.`;
  }
}

load().catch((err) => {
  $('#sample-banner').hidden = false;
  $('#sample-banner').textContent = `Failed to load data: ${err.message}`;
});
