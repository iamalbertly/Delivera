/**
 * Settings hub — section nav, deep links, panel mounts.
 */
import { mountMyWorkspacePanel } from './Delivera-Settings-MyWorkspace-01Panel-UI.js';
import { mountOrganizationPanel } from './Delivera-Settings-Organization-01ReadOnly-Panel-UI.js';
import { mountIntegrationsPanel } from './Delivera-Settings-Integrations-01Health-Panel-UI.js';
import { initSettingsJiraActivityPanel } from './Delivera-Settings-JiraActivity-01Page-01Controller.js';
import { ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

const SECTIONS = [
  { id: 'my-workspace', label: 'My workspace' },
  { id: 'organization', label: 'Organization' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'jira-activity', label: 'Activity' },
];

function renderNavRail(navEl, activeId) {
  if (!navEl) return;
  navEl.innerHTML = SECTIONS.map((s) => (
    `<a href="#${s.id}" class="settings-nav-link${activeId === s.id ? ' is-active' : ''}" data-settings-section="${s.id}">${s.label}</a>`
  )).join('');
}

function setActiveNav(navEl, sectionId) {
  navEl?.querySelectorAll('[data-settings-section]').forEach((link) => {
    const on = link.getAttribute('data-settings-section') === sectionId;
    link.classList.toggle('is-active', on);
    if (on) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export function initSettingsHub() {
  const navEl = document.getElementById('settings-nav-rail');
  const hash = (window.location.hash || '').replace('#', '') || 'my-workspace';
  const activeId = SECTIONS.some((s) => s.id === hash) ? hash : 'my-workspace';

  renderNavRail(navEl, activeId);
  navEl?.addEventListener('click', (ev) => {
    const link = ev.target.closest('[data-settings-section]');
    if (!link) return;
    ev.preventDefault();
    const id = link.getAttribute('data-settings-section');
    if (id) {
      history.replaceState(null, '', `#${id}`);
      setActiveNav(navEl, id);
      scrollToSection(id);
    }
  });

  window.addEventListener('hashchange', () => {
    const next = (window.location.hash || '').replace('#', '');
    if (SECTIONS.some((s) => s.id === next)) {
      setActiveNav(navEl, next);
      scrollToSection(next);
    }
  });

  ensureProjectCatalogLoaded();
  mountMyWorkspacePanel(document.getElementById('settings-my-workspace'));
  mountOrganizationPanel(document.getElementById('settings-organization'));
  mountIntegrationsPanel(document.getElementById('settings-integrations'));
  initSettingsJiraActivityPanel();

  if (hash && hash !== 'my-workspace') {
    requestAnimationFrame(() => scrollToSection(hash));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsHub);
  } else {
    initSettingsHub();
  }
}
