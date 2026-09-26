# TOX Signal

A clinical toxicology event monitor built around one question: **What changed, and what is actually new?**

TOX Signal compares recent U.S. alerts, surveillance findings, and drug supply signals with historical activity. The owner-only prototype runs at https://tox-signal.albertoaugsten.chatgpt.site. This repository holds a separate, dependency-free starter implementation. **Committing here does not update that Site.**

Project lead: Alberto Augsten, PharmD, MS, BCPP, DABAT. Contributors and coding agents should read [AGENTS.md](AGENTS.md) first.

## Status

- The data in `data/sample-events.json` is **synthetic sample data** for layout and testing. It is not real alerts, counts, incidence, or prevalence, and every record points at `example.org`.
- Live feeds (CDC HAN, FDA safety communications, DEA/NFLIS) are listed as **not connected**. No scheduled refresh exists yet.
- Nothing is deployed from this repository.

## Features

- 30-day, 90-day, 12-month, and all-history views, with category and High/Medium/Watch priority filters
- Priority board showing a **relative signal index** per category (historical baseline = 100). It is not a prevalence estimate or an individual risk probability, and it is withheld when the baseline is too thin.
- Source-linked event ledger, signal detail with historical context, and a 12-month activity trend
- Separate fields for source observation, clinical interpretation, forensic/legal implication, and uncertainty
- Review queue: automated findings stay pending, and interpretation text stays hidden until a named reviewer approves the item
- Feed health: failed or stale feeds show their last successful refresh, and their items are never marked NEW

## Run it

Requires Node.js 20 or later. No packages to install.

```bash
npm start   # http://localhost:5173
npm test    # node:test suite
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/model.js` | Event schema and normalization (provenance fields required) |
| `src/dates.js` | UTC calendar-date handling |
| `src/filters.js` | Time windows, category and priority filters, sorting |
| `src/signal-index.js` | Deviation-from-baseline index and its required label |
| `src/trend.js` | 12-month buckets |
| `src/review.js` | Review queue and publish gating |
| `src/feeds.js` | Feed freshness and "new" logic |
| `src/app.js` | Rendering only |
| `data/sample-events.json` | Synthetic sample data |
| `test/` | Tests |

Ingestion, normalization, review status, and display are kept separate so real feed adapters can be added without touching the UI.

## Next steps

1. Write feed adapters for CDC, FDA, and DEA primary sources that produce records in the `src/model.js` shape.
2. Add persistent storage for review decisions.
3. Choose a deployment target and scheduled refresh, then confirm them before any deployment.
