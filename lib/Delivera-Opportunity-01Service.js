export function resolveEnablementScoringStatus(opportunity = {}) {
  if (opportunity.status === 'blocked' || opportunity.blockedBy) {
    return { status: 'enablement_gap', scoreable: false, reason: opportunity.blockedBy || 'Missing sponsor, forum, data access, or decision rights' };
  }
  return { status: 'scoreable', scoreable: true };
}

