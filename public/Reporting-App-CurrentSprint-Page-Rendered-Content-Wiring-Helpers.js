import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Reporting-App-CurrentSprint-Notifications-Helpers.js';
import { showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage, renderCurrentSprintPageParts } from './Reporting-App-CurrentSprint-Render-Page.js';
import { wireDynamicHandlers } from './Reporting-App-CurrentSprint-Page-Handlers.js';
import { wireHeaderBarHandlers } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { wireHealthDashboardHandlers } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { wireRisksAndInsightsHandlers } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { wireSprintCarouselHandlers } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { wireProgressShowMoreHandlers, wireDailyCompletionTimelineHandlers } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { wireExportHandlers } from './Reporting-App-CurrentSprint-Export-Dashboard.js';
import { wireIssuePreviewHandlers } from './Reporting-App-CurrentSprint-Issue-Preview.js';
import { scheduleRender } from './Reporting-App-Report-Page-Loading-Steps.js';
import { markPerf } from './Reporting-App-Shared-Perf-Marks.js';

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

function applyInitialHashFocus() {
  try {
    const hash = window.location && window.location.hash ? window.location.hash : '';
    if (!hash || !hash.startsWith('#')) return;
    const target = document.querySelector(hash);
    if (!target) return;
    window.setTimeout(() => {
      const stickyOffset = 120;
      const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
        const stickyOffset = 120;
        const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      if (menu) {
        menu.hidden = true;
        menu.setAttribute('aria-hidden', 'true');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  const syncActiveLink = () => {
    const offset = 180;
    let activeHref = '';
    targets.forEach((entry) => {
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
        document.getElementById('stories-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
    });
  });
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
  wireAttentionQueueHandlers();
  wireSectionLinks();
  collapseMobileDetailsSections();
  applyInitialHashFocus();
}

export function showCurrentSprintRenderedContent(data, onSelectSprintById, options = {}) {
  const useProgressive = options.progressive !== false;
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
    const anchor = document.querySelector('.sprint-hud-card, .sprint-at-a-glance-hero');
    if (anchor && window.scrollY > 120) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    markPerf('current-sprint', 'fullRenderComplete');
  });
}
