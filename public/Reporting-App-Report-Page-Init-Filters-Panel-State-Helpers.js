function getActiveFiltersCount() {
  let count = 0;
  count += document.querySelectorAll('.project-checkbox:checked').length;
  const startVal = document.getElementById('start-date')?.value || '';
  const endVal = document.getElementById('end-date')?.value || '';
  if (startVal || endVal) count += 1;
  if (document.getElementById('require-resolved-by-sprint-end')?.checked) count += 1;
  const includePredictability = document.getElementById('include-predictability')?.checked;
  if (includePredictability) {
    count += 1;
    if (document.querySelector('input[name="predictability-mode"][value="strict"]')?.checked) count += 1;
  }
  if (document.getElementById('include-active-or-missing-end-date-sprints')?.checked) count += 1;
  return count;
}

export function initReportFiltersPanelState({ collapsedStorageKey, skipTabRestoreForHash = '' }) {
  const panel = document.getElementById('filters-panel');
  const panelBody = document.getElementById('filters-panel-body');
  const collapsedBar = document.getElementById('filters-panel-collapsed-bar');
  const collapsedSummary = document.getElementById('filters-collapsed-summary');
  const appliedSummary = document.getElementById('applied-filters-summary');
  const appliedChips = document.getElementById('applied-filters-chips');

  function setFiltersPanelCollapsed(collapsed) {
    if (!panel || !panelBody || !collapsedBar) return;
    try {
      if (collapsed) sessionStorage.setItem(collapsedStorageKey, '1');
      else sessionStorage.removeItem(collapsedStorageKey);
    } catch (_) {}
    panel.classList.toggle('collapsed', collapsed);
    panelBody.style.display = collapsed ? 'none' : '';
    collapsedBar.style.display = collapsed ? 'flex' : 'none';
    collapsedBar.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
    if (collapsed && collapsedSummary && appliedSummary) {
      const chipsText = (appliedChips?.textContent || '').trim();
      const base = chipsText || appliedSummary.textContent || 'Applied filters';
      collapsedSummary.textContent = base;
    }
  }

  function applyStoredFiltersCollapsed() {
    if (!panel || !panelBody || !collapsedBar) return;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    if (isMobile) {
      setFiltersPanelCollapsed(true);
      return;
    }
    const previewContent = document.getElementById('preview-content');
    const isPreviewVisible = previewContent && previewContent.style.display !== 'none';
    try {
      const stored = sessionStorage.getItem(collapsedStorageKey);
      if (stored === '1' && isPreviewVisible) setFiltersPanelCollapsed(true);
    } catch (_) {}
  }

  document.addEventListener('click', (ev) => {
    const toggle = ev.target.closest && ev.target.closest('[data-action="toggle-filters"]');
    if (!toggle || !panel) return;
    ev.preventDefault();
    setFiltersPanelCollapsed(false);
  });

  window.addEventListener('report-preview-shown', () => {
    if (!panel || !panelBody || !collapsedBar) return;
    try {
      sessionStorage.setItem(collapsedStorageKey, '1');
      setFiltersPanelCollapsed(true);
      if (skipTabRestoreForHash && window.location.hash === skipTabRestoreForHash) return;
      const savedTab = sessionStorage.getItem('report-active-tab');
      if (savedTab) {
        const tabBtn = document.querySelector('.tab-btn[data-tab="' + savedTab + '"]');
        if (tabBtn && !tabBtn.classList.contains('active')) tabBtn.click();
      }
    } catch (_) {}
  });

  setTimeout(applyStoredFiltersCollapsed, 0);
  return {
    refreshCollapsedSummary() {
      if (panel?.classList.contains('collapsed')) setFiltersPanelCollapsed(true);
    },
  };
}
