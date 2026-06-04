/**
 * Maps governance risk types to nudge use-case keys (browser SSOT).
 */
export function riskToUseCase(riskType) {
  switch (String(riskType || '').toLowerCase()) {
    case 'late-scope': return 'scope';
    case 'missing-owner': return 'unassigned';
    case 'missing-estimate': return 'missing-estimate';
    case 'no-log': return 'no-log';
    case 'dependency':
    case 'stale-in-progress': return 'blocker';
    default: return 'ownership';
  }
}
