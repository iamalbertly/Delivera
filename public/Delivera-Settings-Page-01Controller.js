/**
 * Settings hub — section nav, deep links, panel mounts.
 */
import { mountMyWorkspacePanel } from './Delivera-Settings-MyWorkspace-01Panel-UI.js';
import { mountOrganizationPanel } from './Delivera-Settings-Organization-01ReadOnly-Panel-UI.js';
import { mountEpicFormatPanel } from './Delivera-Settings-EpicFormat-01Panel-UI.js';
import { mountIntegrationsPanel } from './Delivera-Settings-Integrations-01Health-Panel-UI.js';
import { initSettingsJiraActivityPanel } from './Delivera-Settings-JiraActivity-01Page-01Controller.js';
import { ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { getSurfaceQuickLinks, PAGE_REPORT } from './Delivera-Shared-Page-Route-01Resolve-SSOT.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { paintInstantShell, clearInstantShell, forgetRememberedSurface, setDeliveraSurfaceState } from './Delivera-Shared-Instant-Shell-01UI.js';

const SECTIONS = [
  { id: 'my-workspace', mountId: 'settings-my-workspace', label: 'My workspace' },
  { id: 'organization', mountId: 'settings-organization', label: 'Organization' },
  { id: 'settings-epic-format', mountId: 'settings-epic-format', label: 'Epic format' },
  { id: 'integrations', mountId: 'settings-integrations', label: 'Integrations' },
  { id: 'jira-activity', mountId: 'jira-activity', label: 'Activity' },
];

const SURFACE_QUICK_LINKS = getSurfaceQuickLinks([PAGE_REPORT]);

function renderQuickNav() {
  const mount = document.getElementById('settings-quick-nav');
  if (!mount) return;
  mount.hidden = true;
  mount.innerHTML = '';
}

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

function setActivePanel(sectionId) {
  SECTIONS.forEach((section) => {
    const mount = document.getElementById(section.mountId);
    if (!mount) return;
    const active = section.id === sectionId;
    mount.hidden = !active;
    mount.toggleAttribute('data-settings-active-panel', active);
  });
}

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

function renderReturnBanner() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('return');
  if (!ret || !ret.startsWith('/')) return;
  const open = params.get('openAlignment');
  const href = open ? `${ret}?openAlignment=${encodeURIComponent(open)}` : ret;
  const hero = document.querySelector('.settings-hero-compact');
  if (!hero || hero.querySelector('[data-settings-return-banner]')) return;
  hero.insertAdjacentHTML('beforeend', `
    <p class="settings-return-banner" data-settings-return-banner>
      <a class="btn btn-primary btn-compact" href="${escapeHtml(href)}">${escapeHtml(COPY.settingsReturnToGovernance)}</a>
    </p>`);
}

export function initSettingsHub() {
  // P0 FIX: Paint instant skeleton shell — no blank white page.
  // Raw settings HTML contains stable IDs and event-bound controls. Restoring it
  // inside the shell would duplicate IDs and can make the real panels disappear.
  forgetRememberedSurface('settings');
  paintInstantShell('settings');
  const navEl = document.getElementById('settings-nav-rail');
  const hash = (window.location.hash || '').replace('#', '') || 'my-workspace';
  const activeId = SECTIONS.some((s) => s.id === hash) ? hash : 'my-workspace';

  renderNavRail(navEl, activeId);
  renderQuickNav();
  renderReturnBanner();
  navEl?.addEventListener('click', (ev) => {
    const link = ev.target.closest('[data-settings-section]');
    if (!link) return;
    ev.preventDefault();
    const id = link.getAttribute('data-settings-section');
    if (id) {
      history.replaceState(null, '', `#${id}`);
      setActiveNav(navEl, id);
      setActivePanel(id);
      scrollToSection(id);
    }
  });

  window.addEventListener('hashchange', () => {
    const next = (window.location.hash || '').replace('#', '');
    if (SECTIONS.some((s) => s.id === next)) {
      setActiveNav(navEl, next);
      setActivePanel(next);
      scrollToSection(next);
    }
  });

  ensureProjectCatalogLoaded();
  mountMyWorkspacePanel(document.getElementById('settings-my-workspace'));
  mountOrganizationPanel(document.getElementById('settings-organization'));
  mountEpicFormatPanel(document.getElementById('settings-epic-format'));
  mountIntegrationsPanel(document.getElementById('settings-integrations'));
  initSettingsJiraActivityPanel();

  setDeliveraSurfaceState('settings', 'live', { scopeLabel: 'Workspace' });
  clearInstantShell();
  const jiraActivity = document.getElementById('jira-activity');
  if (jiraActivity) jiraActivity.hidden = activeId !== 'jira-activity';
  setActivePanel(activeId);

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
