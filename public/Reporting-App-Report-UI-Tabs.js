export function initTabs(updateExportFilteredState, onTabActivate) {
  const REPORT_ACTIVE_TAB_KEY = 'report-active-tab';
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanes = Array.from(document.querySelectorAll('.tab-pane'));
  const tabsContainer = document.querySelector('.tabs');
  const secondaryTabs = new Set();
  const moreItems = [];
  let moreButton = null;
  let moreMenu = null;
  tabButtons.slice(3).forEach((btn) => {
    const tabName = btn?.dataset?.tab;
    if (tabName) secondaryTabs.add(tabName);
  });

  if (tabsContainer) {
    tabsContainer.setAttribute('role', 'tablist');
  }
  const TAB_HELP_TEXT = {
    'project-epic-level': 'Overview: board-level health and signals.',
    trends: 'Trends: how delivery changes over time.',
    sprints: 'Sprints: compare sprint outcomes and timing.',
    'done-stories': 'Outcomes: inspect completed work items.',
    'unusable-sprints': 'Excluded: review hidden/invalid sprints.',
  };

  function closeMoreMenu() {
    if (!moreButton || !moreMenu) return;
    moreMenu.classList.remove('open');
    moreButton.setAttribute('aria-expanded', 'false');
    moreMenu.setAttribute('aria-hidden', 'true');
  }

  function updateMoreButtonLabel(activeTabName = '') {
    if (!moreButton) return;
    if (secondaryTabs.has(activeTabName)) {
      const activeBtn = tabButtons.find((b) => b.dataset.tab === activeTabName);
      const activeLabel = activeBtn ? (activeBtn.textContent || 'More').trim() : 'More';
      moreButton.textContent = 'More: ' + activeLabel;
    } else {
      moreButton.textContent = 'More';
    }
  }

  function activateTab(btn, options = {}) {
    if (!btn) return;
    const { skipFocus = false } = options;
    const tabName = btn.dataset.tab;
    if (!tabName) return;

    tabButtons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      b.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    tabPanes.forEach((p) => p.classList.remove('active'));
    const pane = document.getElementById(`tab-${tabName}`);
    if (pane) {
      pane.classList.add('active');
      if (!skipFocus) {
        const firstFocusable = pane.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
      }
    }
    updateMoreButtonLabel(tabName);
    closeMoreMenu();
    try {
      if (window.location.pathname.endsWith('/report') && tabName === 'trends') {
        if (window.location.hash !== '#trends') history.replaceState(null, '', '/report#trends');
      } else if (window.location.pathname.endsWith('/report') && window.location.hash === '#trends') {
        history.replaceState(null, '', '/report');
      }
    } catch (_) {}
    try { sessionStorage.setItem(REPORT_ACTIVE_TAB_KEY, tabName); } catch (_) {}
    const helper = document.getElementById('tab-outcome-hint');
    if (helper) helper.innerHTML = '<small>' + (TAB_HELP_TEXT[tabName] || 'Use tabs to switch views.') + '</small>';
    const activeTabChip = document.querySelector('[data-preview-active-tab-chip]');
    if (activeTabChip) activeTabChip.textContent = 'Tab: ' + ((btn.textContent || tabName).replace(/\s*\(\d+\)\s*$/, ''));
    try {
      window.dispatchEvent(new CustomEvent('report:active-tab-changed', { detail: { tabName } }));
    } catch (_) {}
    if (updateExportFilteredState) updateExportFilteredState();
    if (onTabActivate && typeof onTabActivate === 'function') onTabActivate(tabName);
  }

  function ensureMoreMenu() {
    if (!tabsContainer || moreButton || !tabButtons.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'tabs-more-wrap';
    wrapper.setAttribute('data-tabs-more', 'true');

    moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'tab-btn tabs-more-btn';
    moreButton.setAttribute('aria-haspopup', 'menu');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.textContent = 'More';

    moreMenu = document.createElement('div');
    moreMenu.className = 'tabs-more-menu';
    moreMenu.setAttribute('role', 'menu');
    moreMenu.setAttribute('aria-hidden', 'true');

    tabButtons.forEach((btn) => {
      const tabName = btn.dataset.tab || '';
      if (!secondaryTabs.has(tabName)) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tabs-more-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = btn.textContent || tabName;
      item.dataset.targetTab = tabName;
      item.addEventListener('click', () => activateTab(btn));
      moreItems.push(item);
      moreMenu.appendChild(item);
    });

    moreButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!moreMenu) return;
      const open = moreMenu.classList.toggle('open');
      moreButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        const first = moreMenu.querySelector('.tabs-more-item');
        if (first) first.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) closeMoreMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMoreMenu();
    });

    wrapper.appendChild(moreButton);
    wrapper.appendChild(moreMenu);
    tabsContainer.appendChild(wrapper);
  }

  function applyResponsiveTabPriority() {
    ensureMoreMenu();
    const mobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1024px)').matches
      : false;
    tabButtons.forEach((btn) => {
      const tabName = btn.dataset.tab || '';
      const isSecondary = secondaryTabs.has(tabName);
      btn.classList.toggle('tab-btn-secondary-mobile-hidden', mobile && isSecondary);
    });
    if (moreButton && moreMenu) {
      const showMore = mobile && moreItems.length > 0;
      moreButton.style.display = showMore ? '' : 'none';
      moreMenu.setAttribute('aria-hidden', 'true');
      if (!showMore) closeMoreMenu();
    }
  }

  tabButtons.forEach((btn) => {
    if (!btn.hasAttribute('role')) {
      btn.setAttribute('role', 'tab');
    }
    const isActive = btn.classList.contains('active');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');

    btn.addEventListener('click', () => {
      activateTab(btn);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const visibleButtons = tabButtons.filter((b) => !b.classList.contains('tab-btn-secondary-mobile-hidden'));
        const buttons = visibleButtons.length ? visibleButtons : tabButtons;
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const currentIndex = buttons.indexOf(btn);
        const nextIndex = (currentIndex + dir + buttons.length) % buttons.length;
        const nextBtn = buttons[nextIndex];
        nextBtn.focus();
        activateTab(nextBtn, { skipFocus: true });
      }
    });
  });

  applyResponsiveTabPriority();
  try {
    window.addEventListener('resize', applyResponsiveTabPriority, { passive: true });
  } catch (_) {
    window.addEventListener('resize', applyResponsiveTabPriority);
  }
  const activeTab = tabButtons.find((b) => b.classList.contains('active'));
  updateMoreButtonLabel(activeTab?.dataset?.tab || '');
  try {
    const hashTab = (window.location && window.location.hash === '#trends')
      ? tabButtons.find((b) => b.dataset.tab === 'trends')
      : null;
    if (hashTab) {
      activateTab(hashTab, { skipFocus: true });
      return;
    }
    if (activeTab) {
      activateTab(activeTab, { skipFocus: true });
    }
  } catch (_) {}
}
