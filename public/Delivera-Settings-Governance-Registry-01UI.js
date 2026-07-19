import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

const mount = document.getElementById('gov-settings-registry-mount');
let registry = null;

function personName(value) { return typeof value === 'string' ? value : value?.displayName || value?.name || ''; }

function row(item) {
  return `<form class="registry-row" data-registry-squad="${escapeHtml(item.squadKey)}"><div class="registry-identity"><strong>${escapeHtml(item.friendlyName)}</strong><small>${escapeHtml(item.squadKey)}${item.boardMapping?.length ? ` · ${escapeHtml(item.boardMapping.join(', '))}` : ' · board mapping not confirmed'}</small></div><label><span>Participation</span><select name="participationState"><option value="pi-governed" ${item.participationState === 'pi-governed' ? 'selected' : ''}>PI-governed</option><option value="pending-consent" ${item.participationState === 'pending-consent' ? 'selected' : ''}>Pending consent</option><option value="operational-exception" ${item.participationState === 'operational-exception' ? 'selected' : ''}>Operational exception</option></select></label><label><span>Product Owner</span><input name="productOwner" value="${escapeHtml(personName(item.productOwner))}" placeholder="Not assigned"></label><label><span>Scrum Master</span><input name="scrumMaster" value="${escapeHtml(personName(item.scrumMaster))}" placeholder="Not assigned"></label><label><span>Stream lead</span><input name="streamLead" value="${escapeHtml(personName(item.streamLead))}" placeholder="Not assigned"></label><div class="registry-save"><input name="reason" placeholder="Reason for change" aria-label="Reason for ${escapeHtml(item.friendlyName)} change"><button class="btn btn-secondary btn-compact" type="submit">Save squad</button><small data-registry-status aria-live="polite">${item.lastVerifiedAt ? `Verified ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : 'Not yet verified'}</small></div></form>`;
}

function render() {
  mount.innerHTML = `<div class="registry-head"><div><p class="surface-eyebrow">Organization truth</p><h2 id="governance-registry-title">PI participation and owner routes</h2><p>These audited settings control portfolio inclusion and safe owner fallbacks. Personal display preferences never change PI totals.</p></div><span>Registry v${Number(registry.version) || 1}</span></div><div class="registry-list">${(registry.squads || []).map(row).join('')}</div>`;
  mount.querySelectorAll('[data-registry-squad]').forEach((form) => form.addEventListener('submit', save));
}

async function save(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('[data-registry-status]');
  const data = new FormData(form);
  const reason = String(data.get('reason') || '').trim();
  if (!reason) { status.textContent = 'Add a reason so the organization change is auditable.'; form.elements.reason.focus(); return; }
  const body = { participationState: data.get('participationState'), productOwner: data.get('productOwner') ? { displayName: data.get('productOwner') } : null, scrumMaster: data.get('scrumMaster') ? { displayName: data.get('scrumMaster') } : null, streamLead: data.get('streamLead') ? { displayName: data.get('streamLead') } : null, reason };
  form.querySelector('button').disabled = true; status.textContent = 'Saving organization truth…';
  const response = await fetch(`/api/governance/registry/${encodeURIComponent(form.dataset.registrySquad)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${registry.version}"` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (response.status === 412) { status.textContent = result.error || 'Settings changed elsewhere. Your draft is preserved; reload latest values.'; form.querySelector('button').disabled = false; return; }
  if (!response.ok) { status.textContent = result.error || 'Save failed. No organization truth was changed.'; form.querySelector('button').disabled = false; return; }
  registry = result; render();
}

async function load() {
  try {
    const response = await fetch('/api/governance/registry.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error();
    registry = await response.json(); render();
  } catch (_) {
    mount.innerHTML = '<h2 id="governance-registry-title">PI participation and owner routes</h2><p>Organization settings are unavailable. Governance will keep the last verified projection and block registry writes.</p>';
  }
}

void load();
