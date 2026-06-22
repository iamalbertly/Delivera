/**
 * Settings — integrations health (Jira, cache) + AI helper mount.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { mountGovernanceAiHelper } from './Delivera-Settings-Governance-AI-01Helper-UI.js';

function jiraHealthRow(row) {
  const label = row.shortLabel || row.label || row.key;
  let status = 'settings-access-unknown';
  let text = 'Not checked';
  if (row.accessible === true) { status = 'settings-access-ok'; text = 'Boards found'; }
  else if (row.accessible === false) { status = 'settings-access-warn'; text = 'No access'; }
  return `<li class="settings-health-row"><span>${escapeHtml(label)} <code>${escapeHtml(row.key)}</code></span><span class="${status}">${text}</span></li>`;
}

export function mountIntegrationsPanel(mount) {
  if (!mount) return;

  async function renderHealth(host) {
    const healthEl = host.querySelector('[data-integrations-health]');
    if (!healthEl) return;
    try {
      const [runtimeRes, catalogRes] = await Promise.all([
        fetch('/api/settings/runtime.json', { credentials: 'same-origin' }),
        fetch('/api/projects-catalog.json', { credentials: 'same-origin' }),
      ]);
      const runtime = runtimeRes.ok ? await runtimeRes.json() : {};
      const catalog = catalogRes.ok ? await catalogRes.json() : {};
      const summary = runtime.summary || {};
      const jiraHost = summary.jiraHost || '—';
      const tokenLen = summary.jiraApiTokenLength || 0;
      const cache = summary.redisBackend || 'memory';
      const authMode = summary.authMode || '—';
      const projects = catalog.projects || [];
      const failing = projects.filter((p) => p.accessible === false);
      const healthClass = runtime.ok ? 'settings-health-ok' : 'settings-health-warn';

      healthEl.innerHTML = `
        <div class="settings-health-summary ${healthClass}">
          <p><strong>Jira</strong> ${escapeHtml(jiraHost)} · token ${tokenLen ? 'configured' : 'missing'} · auth ${escapeHtml(authMode)}</p>
          <p><strong>Cache</strong> ${escapeHtml(cache)}</p>
        </div>
        <h3 class="gov-ai-helper-sub">Project access</h3>
        <ul class="settings-health-list">${projects.map(jiraHealthRow).join('')}</ul>
        ${failing.length ? `<p class="gov-ai-helper-note">${failing.length} project(s) need Jira access review.</p>` : ''}`;
    } catch (err) {
      healthEl.innerHTML = `<p class="jira-activity-error" role="alert">Health check failed — ${escapeHtml(err.message)}</p>`;
    }
  }

  mount.innerHTML = `
    <section id="integrations" class="surface-card settings-section-card" tabindex="-1">
      <h2>Integrations</h2>
      <p class="gov-ai-helper-lead">Connection health and AI trust. Server credentials are administrator-managed.</p>
      <div data-integrations-health class="settings-integrations-health">Loading health…</div>
      <div id="gov-settings-ai-mount"></div>
    </section>`;

  renderHealth(mount);
  mountGovernanceAiHelper(mount.querySelector('#gov-settings-ai-mount'), { embedded: true });
}
