import { renderNotificationDock } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Delivera-CurrentSprint-Notifications-Helpers.js';
import { showContent } from './Delivera-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage, renderCurrentSprintPageParts } from './Delivera-CurrentSprint-Render-Page.js';
import { wireDynamicHandlers } from './Delivera-CurrentSprint-Page-Handlers.js';
import { wireHeaderBarHandlers } from './Delivera-CurrentSprint-Header-Bar.js';
import { wireHealthDashboardHandlers } from './Delivera-CurrentSprint-Health-Dashboard.js';
import { wireRisksAndInsightsHandlers } from './Delivera-CurrentSprint-Risks-Insights.js';
import { wireSprintCarouselHandlers } from './Delivera-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Delivera-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Delivera-CurrentSprint-Render-Subtasks.js';
import { wireProgressShowMoreHandlers, wireDailyCompletionTimelineHandlers } from './Delivera-CurrentSprint-Render-Progress.js';
import { wireExportHandlers } from './Delivera-CurrentSprint-Export-Dashboard.js';
import { wireIssuePreviewHandlers } from './Delivera-CurrentSprint-Issue-Preview.js';
import { wireDecisionCockpitHandlers } from './Delivera-CurrentSprint-Decision-Cockpit.js';
import { scheduleRender } from './Delivera-Report-Page-Loading-Steps.js';
import { markPerf } from './Delivera-Shared-Perf-Marks.js';
import { getCurrentSprintSummaryContext } from './Delivera-CurrentSprint-Action-Bridge.js';

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

/**
 * ALB-84: include sprint HUD bar +, when scrolling within Mission-critical work, the sticky primary
 * controls strip (.stories-primary-sticky) so table/anchors land under the full sticky stack.
 */
function getStickyHeaderOffset(targetEl) {
  const header = document.querySelector('.current-sprint-header-bar');
  const navTop = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-global-nav-top') || '56') || 56;
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  let primaryStrip = 0;
  if (targetEl && typeof targetEl.closest === 'function' && targetEl.closest('#stories-card')) {
    const primary = document.querySelector('#stories-card .stories-primary-sticky');
    if (primary) {
      const pos = getComputedStyle(primary).position;
      if (pos === 'sticky' || pos === '-webkit-sticky') {
        primaryStrip = Math.ceil(primary.getBoundingClientRect().height);
      }
    }
  }
  return Math.max(96, Math.ceil(navTop + headerHeight + primaryStrip + 12));
}

function scrollToCurrentSprintTarget(target) {
  if (!target) return;
  const stickyOffset = getStickyHeaderOffset(target);
  const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function applyInitialHashFocus() {
  try {
    const hash = window.location && window.location.hash ? window.location.hash : '';
    if (!hash || !hash.startsWith('#')) return;
    const target = document.querySelector(hash);
    if (!target) return;
    window.setTimeout(() => {
      scrollToCurrentSprintTarget(target);
    }, 60);
  } catch (_) {}
}

function wireSectionLinks() {
  const nav = document.querySelector('.sprint-section-links');
  if (!nav || nav.dataset.wiredSectionLinks === '1') return;
  nav.dataset.wiredSectionLinks = '1';
  const trigger = nav.querySelector('.sprint-section-dropdown-trigger');
  const menu = document.getElementById('sprint-section-dropdown-menu');
  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.getAttribute('aria-hidden') !== 'true';
      menu.hidden = open;
      menu.setAttribute('aria-hidden', open ? 'true' : 'false');
      trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    document.addEventListener('click', () => {
      menu.hidden = true;
      menu.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  }
  const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;
  const targets = links
    .map((link) => ({ link, target: document.querySelector(link.getAttribute('href') || '') }))
    .filter((entry) => entry.target);
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        scrollToCurrentSprintTarget(target);
      }
      if (menu) {
        menu.hidden = true;
        menu.setAttribute('aria-hidden', 'true');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  const syncActiveLink = () => {
    let activeHref = '';
    targets.forEach((entry) => {
      const offset = getStickyHeaderOffset(entry.target);
      const top = entry.target.getBoundingClientRect().top;
      if (top - offset <= 0) activeHref = entry.link.getAttribute('href') || activeHref;
    });
    targets.forEach((entry) => entry.link.classList.toggle('is-active', (entry.link.getAttribute('href') || '') === activeHref));
  };
  syncActiveLink();
  window.addEventListener('scroll', syncActiveLink, { passive: true });
}

function wireAttentionQueueHandlers() {
  document.querySelectorAll('[data-attention-action]').forEach((button) => {
    if (button.dataset.attentionWired === '1') return;
    button.dataset.attentionWired = '1';
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-attention-action') || '';
      const riskTagMap = {
        'open-blockers': ['blocker'],
        'open-missing-estimate': ['missing-estimate'],
        'open-unassigned': ['unassigned'],
      };
      const tags = riskTagMap[action];
      if (tags) {
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
            detail: { riskTags: tags, source: action },
          }));
        } catch (_) {}
        scrollToCurrentSprintTarget(document.getElementById('stories-card'));
      }
    });
  });
}

function wireSummaryActionBridge() {
  if (window.__currentSprintSummaryActionBridgeBound) return;
  window.__currentSprintSummaryActionBridgeBound = true;
  const ribbon = document.getElementById('current-sprint-ribbon');
  if (!ribbon) return;

  function renderRibbonFromContext(context) {
    if (!context) return;
    const action = String(context.topAction || context.next || '').trim();
    const headline = String(context.header || 'Summary copied').trim();
    if (!action && !headline) return;
    const text = [headline, action ? `Next: ${action}` : ''].filter(Boolean).join(' | ');
    ribbon.textContent = text;
    ribbon.style.display = '';
    ribbon.setAttribute('data-state', 'fresh');
  }

  window.addEventListener('currentSprint:summaryCopied', (event) => {
    const context = event?.detail?.context || getCurrentSprintSummaryContext();
    renderRibbonFromContext(context);
  });

  const cached = getCurrentSprintSummaryContext();
  if (cached) renderRibbonFromContext(cached);
}

function wireNoClickJourneys() {
  if (window.__currentSprintNoClickJourneysBound) return;
  window.__currentSprintNoClickJourneysBound = true;

  function openTopRiskPreviewIfNeeded() {
    try {
      const alreadyOpened = sessionStorage.getItem('delivera.currentSprint.topRiskPreviewOpened.v1') === '1';
      if (alreadyOpened) return;
      const row = document.querySelector('#work-risks-table tbody tr[data-risk-tags], #stories-table tbody tr[data-risk-tags]');
      if (!row) return;
      sessionStorage.setItem('delivera.currentSprint.topRiskPreviewOpened.v1', '1');
      window.dispatchEvent(new CustomEvent('currentSprint:openIssuePreviewForRow', { detail: { row } }));
    } catch (_) {}
  }

  function wireKeyboardShortcuts() {
    if (window.__currentSprintKeyboardShortcutsBound) return;
    window.__currentSprintKeyboardShortcutsBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      if (event.key === 's' || event.key === 'S') {
        const copySummaryBtn = document.querySelector('.export-dashboard-btn.export-default-action');
        if (copySummaryBtn) {
          event.preventDefault();
          copySummaryBtn.click();
        }
      } else if (event.key === 'g' || event.key === 'G') {
        const quickNudgeBtn = document.querySelector('[data-action="copy-top-guided-nudge"]');
        if (quickNudgeBtn) {
          event.preventDefault();
          quickNudgeBtn.click();
        }
      } else if (event.key === '/') {
        const filterInput = document.getElementById('issue-jump-input');
        if (filterInput) {
          event.preventDefault();
          filterInput.focus();
          filterInput.select?.();
        }
      }
    });
  }

  window.setTimeout(openTopRiskPreviewIfNeeded, 260);
  wireKeyboardShortcuts();
}

export function appendCurrentSprintLoginLink(errorEl) {
  if (!errorEl || errorEl.querySelector('a.nav-link')) return;
  const link = document.createElement('a');
  const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  link.href = '/?redirect=' + redirect;
  link.className = 'nav-link';
  link.textContent = 'Sign in';
  link.style.marginLeft = '8px';
  errorEl.appendChild(document.createTextNode(' '));
  errorEl.appendChild(link);
}

function wireRenderedContent(data, onSelectSprintById) {
  try {
    window.currentSprintScrollToTarget = scrollToCurrentSprintTarget;
  } catch (_) {}
  const summary = updateNotificationStore(data);
  renderNotificationDock({ summary, pageContext: 'current-sprint' });
  wireDynamicHandlers(data);
  wireHeaderBarHandlers();
  wireHealthDashboardHandlers();
  wireRisksAndInsightsHandlers();
  wireCountdownTimerHandlers();
  wireSubtasksShowMoreHandlers();
  wireProgressShowMoreHandlers();
  wireDailyCompletionTimelineHandlers();
  wireSprintCarouselHandlers((sprintId) => onSelectSprintById(sprintId));
  wireExportHandlers(data);
  wireIssuePreviewHandlers();
  wireDecisionCockpitHandlers();
  wireSummaryActionBridge();
  wireNoClickJourneys();
  wireAttentionQueueHandlers();
  wireSectionLinks();
  collapseMobileDetailsSections();
  applyInitialHashFocus();
}

export function showCurrentSprintRenderedContent(data, onSelectSprintById, options = {}) {
  const useProgressive = options.progressive === true;
  if (!useProgressive) {
    showContent(renderCurrentSprintPage(data));
    wireRenderedContent(data, onSelectSprintById);
    markPerf('current-sprint', 'firstValueRendered', { firstValueSource: options.source || 'live' });
    markPerf('current-sprint', 'fullRenderComplete');
    return;
  }

  const parts = renderCurrentSprintPageParts(data);
  showContent(parts.initialHtml);
  markPerf('current-sprint', 'firstValueRendered', { firstValueSource: options.source || 'live' });

  if (!parts.hasDeferredSections) {
    wireRenderedContent(data, onSelectSprintById);
    markPerf('current-sprint', 'fullRenderComplete');
    return;
  }

  scheduleRender(() => {
    showContent(parts.fullHtml);
    wireRenderedContent(data, onSelectSprintById);
    const anchor = document.querySelector('.current-sprint-header-bar, .sprint-jump-rail');
    if (anchor && window.scrollY > 120) {
      scrollToCurrentSprintTarget(anchor);
    }
    markPerf('current-sprint', 'fullRenderComplete');
  });
}
