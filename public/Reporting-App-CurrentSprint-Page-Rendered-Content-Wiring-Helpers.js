import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Reporting-App-CurrentSprint-Notifications-Helpers.js';
import { showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage } from './Reporting-App-CurrentSprint-Render-Page.js';
import { wireDynamicHandlers } from './Reporting-App-CurrentSprint-Page-Handlers.js';
import { wireHeaderBarHandlers } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { wireHealthDashboardHandlers } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { wireRisksAndInsightsHandlers } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { wireCapacityAllocationHandlers } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { wireSprintCarouselHandlers } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { wireProgressShowMoreHandlers, wireDailyCompletionTimelineHandlers } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { wireExportHandlers } from './Reporting-App-CurrentSprint-Export-Dashboard.js';
import { wireIssuePreviewHandlers } from './Reporting-App-CurrentSprint-Issue-Preview.js';

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

function wireSectionLinks() {
  const nav = document.querySelector('.sprint-section-links');
  if (!nav || nav.dataset.wiredSectionLinks === '1') return;
  nav.dataset.wiredSectionLinks = '1';
  const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      const stickyOffset = 120;
      const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      links.forEach((a) => a.classList.toggle('is-active', a === link));
    });
  });
  try {
    const sections = links
      .map((link) => ({ link, target: document.querySelector(link.getAttribute('href') || '') }))
      .filter((x) => x.target);
    if (sections.length <= 1) {
      nav.setAttribute('hidden', 'hidden');
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      if (!visible) return;
      sections.forEach(({ link, target }) => link.classList.toggle('is-active', target === visible.target));
    }, { rootMargin: '-110px 0px -60% 0px', threshold: [0, 0.1, 0.5] });
    sections.forEach(({ target }) => observer.observe(target));
  } catch (_) {}
}

export function appendCurrentSprintLoginLink(errorEl) {
  if (!errorEl || errorEl.querySelector('a.nav-link')) return;
  const link = document.createElement('a');
  link.href = '/?redirect=/current-sprint';
  link.className = 'nav-link';
  link.textContent = 'Sign in';
  link.style.marginLeft = '8px';
  errorEl.appendChild(document.createTextNode(' '));
  errorEl.appendChild(link);
}

export function showCurrentSprintRenderedContent(data, onSelectSprintById) {
  showContent(renderCurrentSprintPage(data));
  const summary = updateNotificationStore(data);
  renderNotificationDock({ summary, pageContext: 'current-sprint' });
  wireDynamicHandlers(data);
  wireHeaderBarHandlers();
  wireHealthDashboardHandlers();
  wireRisksAndInsightsHandlers();
  wireCapacityAllocationHandlers();
  wireCountdownTimerHandlers();
  wireSubtasksShowMoreHandlers();
  wireProgressShowMoreHandlers();
  wireDailyCompletionTimelineHandlers();
  wireSprintCarouselHandlers((sprintId) => onSelectSprintById(sprintId));
  wireExportHandlers(data);
  wireIssuePreviewHandlers();
  wireSectionLinks();
  collapseMobileDetailsSections();
}
