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
  const toggleSelectors = '[data-action="toggle-filters"]';
  const isDesktopDrawer = () => {
    try {
      return document.body?.classList?.contains('report-page')
        && typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(min-width: 1025px)').matches;
    } catch (_) {
      return false;
    }
  };

  function updateToggleLabels(collapsed) {
    document.querySelectorAll(toggleSelectors).forEach((button) => {
      button.textContent = collapsed ? 'Filters' : 'Hide filters';
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  }

  function setFiltersPanelCollapsed(collapsed) {
    if (!panel || !panelBody || !collapsedBar) return;
    try {
      if (collapsed) sessionStorage.setItem(collapsedStorageKey, '1');
      else sessionStorage.removeItem(collapsedStorageKey);
    } catch (_) {}
    panel.classList.toggle('collapsed', collapsed);
    panel.classList.toggle('expanded', !collapsed && isDesktopDrawer());
    panelBody.style.display = collapsed ? 'none' : '';
    const showCollapsedBar = collapsed && !isDesktopDrawer();
    collapsedBar.style.display = showCollapsedBar ? 'flex' : 'none';
    collapsedBar.setAttribute('aria-hidden', showCollapsedBar ? 'false' : 'true');
    updateToggleLabels(collapsed);
    if (collapsed && collapsedSummary && appliedSummary) {
      const chipsText = (appliedChips?.textContent || '').trim();
      const base = chipsText || appliedSummary.textContent || 'Applied filters';
      collapsedSummary.textContent = base;
    }
  }

  function applyStoredFiltersCollapsed() {
    if (!panel || !panelBody || !collapsedBar) return;
    if (isDesktopDrawer()) {
      setFiltersPanelCollapsed(false);
      return;
    }
    const previewContent = document.getElementById('preview-content');
    const isPreviewVisible = previewContent && previewContent.style.display !== 'none';
    let shouldCollapse = false;
    try {
      const stored = sessionStorage.getItem(collapsedStorageKey);
      if (stored === '1' && isPreviewVisible) {
        shouldCollapse = true;
      }
    } catch (_) {}
    if (!shouldCollapse) return;
    setFiltersPanelCollapsed(true);
  }

  document.addEventListener('click', (ev) => {
    const toggle = ev.target.closest && ev.target.closest('[data-action="toggle-filters"]');
    if (!toggle || !panel) return;
    ev.preventDefault();
    setFiltersPanelCollapsed(!panel.classList.contains('collapsed'));
  });

  document.addEventListener('click', (ev) => {
    if (!isDesktopDrawer() || panel?.classList.contains('collapsed')) return;
    const insidePanel = ev.target.closest && ev.target.closest('#filters-panel');
    const toggle = ev.target.closest && ev.target.closest(toggleSelectors);
    if (!insidePanel && !toggle) {
      setFiltersPanelCollapsed(true);
    }
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
  updateToggleLabels(!panel || panel.classList.contains('collapsed'));
  return {
    refreshCollapsedSummary() {
      if (panel?.classList.contains('collapsed')) setFiltersPanelCollapsed(true);
    },
  };
}
