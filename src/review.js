// Review queue. Automated findings are held here until a person approves them.
// Clinical, forensic/legal, and causation language is only shown publicly for
// approved items.

export function reviewQueue(events) {
  return events
    .filter((e) => e.reviewState === 'pending_review')
    .sort((a, b) => b.retrievedAt - a.retrievedAt);
}

/** Returns a new event with an updated review decision (does not mutate). */
export function decide(event, decision, reviewer) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error(`invalid decision "${decision}"`);
  if (!reviewer || !String(reviewer).trim()) throw new Error('a named reviewer is required');
  return { ...event, reviewState: decision, reviewedBy: String(reviewer).trim() };
}

/**
 * Fields safe to display for an event given its review state.
 * Pending/rejected items expose only the source observation.
 */
export function publicView(event) {
  const approved = event.reviewState === 'approved';
  const held = 'Awaiting human review — not published.';
  return {
    observation: event.observation,
    clinicalInterpretation: approved ? event.clinicalInterpretation : held,
    forensicImplication: approved ? event.forensicImplication : held,
    uncertainty: event.uncertainty,
  };
}
