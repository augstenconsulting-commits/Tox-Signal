# Agent instructions for TOX Signal

## Project

TOX Signal is a clinical toxicology event monitor. Its central question is: **What changed, and what is actually new?** It compares recent U.S. alerts, surveillance findings, and drug supply signals with historical activity. The existing owner-only prototype is at https://tox-signal.albertoaugsten.chatgpt.site. This repository may initially contain only planning files; inspect it before assuming the deployed source is here.

Project lead: Alberto Augsten, PharmD, MS, BCPP, DABAT.

## Before changing anything

1. Read this file, the README, package manifests, and the relevant source files. Check the current branch and uncommitted changes.
2. Identify whether the requested work belongs to this repository or the separate live Site. Do not claim a Git commit updated the live Site unless the deployment path is verified.
3. Make a small plan for the requested change. Preserve unrelated edits and existing product behavior.

## Product behavior

- Support 30-day, 90-day, 12-month, and all-history views; category and High/Medium/Watch priority filters.
- Present a priority board, source-linked event ledger, signal detail, historical context, and a 12-month activity trend.
- Treat a deviation-from-baseline index (historical baseline = 100) as a **relative signal index**, never a prevalence estimate or individual risk probability.
- Keep distinct: source observation, clinical interpretation, forensic or legal implication, and uncertainty.
- Put new automated findings into a review queue. Human review is required before publishing clinical, legal, forensic, or causation language.
- Prefer primary sources such as CDC, FDA, and DEA, linking the specific item and its publication or event date. Do not invent a source, quote, statistic, or current alert.

## Clinical and data safeguards

- Do not identify a substance from symptoms alone or imply that a population signal proves causation in a patient.
- Label sample or prototype data clearly. Do not represent synthetic indices as measured incidence, exposure counts, or prevalence.
- Keep secrets, API keys, private patient information, and unpublished case material out of Git history, logs, screenshots, and client-side bundles.
- If a feed fails or is stale, show its status and last successful refresh. Do not silently present old items as new.

## Implementation and verification

- Follow the frameworks and commands actually present in the repository. Do not introduce a new stack merely because the repo is empty.
- Keep ingestion, normalization, review status, and display logic separable. Store source URL, source organization, event date, retrieval time, and review state for every event.
- Add focused tests for changed parsing, date handling, priority/filter logic, and index labeling when those paths exist. Run the smallest relevant checks and report the results.
- Before deployment, confirm the target environment and whether scheduled refresh is connected. Deployment or publication requires an explicit user request.

## Reporting work

Summarize what changed, where it changed, what was verified, and any remaining limitation. Distinguish repository changes from changes visible on the live Site.
