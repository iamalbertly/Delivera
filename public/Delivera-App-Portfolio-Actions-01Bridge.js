/**
 * Opens Actions surface filtered to portfolio case context.
 */
export function openPortfolioActions({ caseId = '', project = '', period = '', tab = 'ready' } = {}) {
  const params = new URLSearchParams();
  if (caseId) params.set('caseId', caseId);
  if (project) params.set('project', project);
  if (period) params.set('period', period);
  if (tab) params.set('tab', tab);
  const qs = params.toString();
  window.location.href = qs ? `/actions?${qs}` : '/actions';
}

export function openPortfolioActionsDrawer(decision = {}, cases = []) {
  const anchor = decision.anchorProject || '';
  const match = cases.find((c) => c.project === anchor) || cases[0];
  openPortfolioActions({
    caseId: match?.id || '',
    project: anchor,
    period: decision.periodKey || '',
    tab: 'ready',
  });
}
