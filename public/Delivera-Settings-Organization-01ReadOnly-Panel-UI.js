/**
 * Settings — organization read-only (catalog, governance rules).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

const THRESHOLD_LABELS = {
  staleInProgressHours: 'Stale in progress',
  staleEscalateHours: 'Escalate after',
  staleCriticalHours: 'Critical after',
  riskBriefTopN: 'Top risks in Brief',
  noRecentCommentHours: 'No recent comment',
  backlogNoMovementHours: 'Backlog no movement',
};

function formatHours(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return String(h);
  if (n < 24) return `${n} hours`;
  if (n % 24 === 0) return `${n / 24} day${n / 24 === 1 ? '' : 's'}`;
  return `${n} hours`;
}

function accessBadge(accessible, lastChecked) {
  if (accessible === true) return '<span class="settings-access-ok">Verified</span>';
  if (accessible === false) return '<span class="settings-access-warn">Limited</span>';
  return '<span class="settings-access-unknown">Not checked</span>';
}

function renderCatalogTable(catalog, accessSummary) {
  const accessByKey = {};
  for (const row of accessSummary || []) accessByKey[row.key] = row;
  if (!catalog?.length) return '<p class="gov-ai-helper-note">No projects in catalog.</p>';
  let html = '<table class="settings-org-table"><thead><tr>';
  html += '<th scope="col">Jira key</th><th scope="col">Display name</th><th scope="col">Short</th><th scope="col">Default</th><th scope="col">Access</th>';
  html += '</tr></thead><tbody>';
  for (const row of catalog) {
    const acc = accessByKey[row.key] || row;
    html += '<tr>';
    html += `<td><code>${escapeHtml(row.key)}</code></td>`;
    html += `<td>${escapeHtml(row.label || row.key)}</td>`;
    html += `<td>${escapeHtml(row.shortLabel || '—')}</td>`;
    html += `<td>${row.defaultSelected ? 'Yes' : '—'}</td>`;
    html += `<td>${accessBadge(acc.accessible, acc.lastChecked)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderGovernanceDetails(profile) {
  if (!profile?.thresholds) return '';
  const rows = Object.entries(THRESHOLD_LABELS).map(([key, label]) => {
    const val = profile.thresholds[key];
    if (val == null) return '';
    const formatted = key.includes('Hours') ? formatHours(val) : String(val);
    return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formatted)}</td></tr>`;
  }).filter(Boolean).join('');
  const suppressed = (profile.suppressedRiskTypes || []).length;
  const aliases = profile.stakeholderAliasCount || 0;
  return `
    <details class="settings-governance-details">
      <summary>Delivery rules (read-only)</summary>
      <table class="settings-org-table settings-org-table-compact"><tbody>${rows}</tbody></table>
      <p class="gov-ai-helper-note">Suppressed risk types: ${suppressed}. Stakeholder aliases: ${aliases}. Managed via administrator JSON/API.</p>
    </details>`;
}

export function mountOrganizationPanel(mount) {
  if (!mount) return;

  async function render() {
    mount.innerHTML = '<section class="surface-card settings-section-card"><p class="gov-ai-helper-note">Loading organization settings…</p></section>';
    const projects = readSharedProjectsCsv().join(',');
    const qs = projects ? `?projects=${encodeURIComponent(projects)}` : '';
    try {
      const res = await fetch(`/api/settings/org-summary.json${qs}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sourceNote = data.catalogSource === 'json'
        ? ''
        : '<p class="settings-catalog-banner" role="status">Using built-in catalog — administrator can add data/Delivera-Org-Project-Catalog.json</p>';
      const displayNote = data.displayMode
        ? `<p class="gov-ai-helper-note">Display mode: <strong>${escapeHtml(data.displayMode)}</strong> (set via DELIVERA_PROJECT_DISPLAY_MODE)</p>`
        : '';

      mount.innerHTML = `
        <section id="organization" class="surface-card settings-section-card" tabindex="-1">
          <h2>Organization</h2>
          <p class="gov-ai-helper-lead">Squad names and delivery rules configured by your administrator. Read-only here.</p>
          ${sourceNote}
          ${displayNote}
          ${renderCatalogTable(data.catalog, data.accessSummary)}
          ${renderGovernanceDetails(data.governanceProfile)}
          <p class="gov-ai-helper-note">To change squad names or rules, contact your administrator. Catalog: <code>data/Delivera-Org-Project-Catalog.json</code></p>
        </section>`;
    } catch (err) {
      mount.innerHTML = `
        <section id="organization" class="surface-card settings-section-card" tabindex="-1">
          <h2>Organization</h2>
          <p class="jira-activity-error" role="alert">Could not load organization summary — ${escapeHtml(err.message)}</p>
        </section>`;
    }
  }

  render();
}
