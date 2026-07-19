import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

const mount = document.getElementById('gov-settings-registry-mount');
let registry = null;

function personName(value) { return typeof value === 'string' ? value : value?.displayName || value?.name || ''; }

function row(item) {
  const boardCandidates = item.suggestions?.boardMapping || [];
  const people = item.suggestions?.people || [];
  const peopleOptions = people.map((person) => `<option value="${escapeHtml(person.displayName)}">${escapeHtml(person.evidence || '')}</option>`).join('');
  const boardCopy = item.boardMapping?.length ? `Boards ${item.boardMapping.join(', ')}` : boardCandidates.length ? `Suggested: ${boardCandidates.map((board) => board.name).join(', ')}` : 'Board mapping not confirmed';
  return `<form class="registry-row registry-row--compact" data-registry-squad="${escapeHtml(item.squadKey)}"><div class="registry-identity"><strong>${escapeHtml(item.friendlyName)}</strong><small>${escapeHtml(item.squadKey)} · ${escapeHtml(item.participationState.replace(/-/g, ' '))} · ${escapeHtml(boardCopy)}</small></div><div class="registry-route-summary"><span>${escapeHtml(personName(item.productOwner) || 'PO unresolved')}</span><span>${escapeHtml(personName(item.scrumMaster) || 'SM unresolved')}</span></div><button class="btn btn-secondary btn-compact" type="button" data-registry-edit aria-expanded="false">Review squad</button><div class="registry-editor" hidden><label><span>Participation</span><select name="participationState"><option value="pi-governed" ${item.participationState === 'pi-governed' ? 'selected' : ''}>PI-governed</option><option value="pending-consent" ${item.participationState === 'pending-consent' ? 'selected' : ''}>Pending consent</option><option value="operational-exception" ${item.participationState === 'operational-exception' ? 'selected' : ''}>Operational exception</option></select></label><label><span>Product Owner</span><input name="productOwner" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.productOwner))}" placeholder="Not assigned"></label><label><span>Scrum Master</span><input name="scrumMaster" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.scrumMaster))}" placeholder="Not assigned"></label><label><span>Stream lead</span><input name="streamLead" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.streamLead))}" placeholder="Not assigned"></label><datalist id="people-${escapeHtml(item.squadKey)}">${peopleOptions}</datalist><div class="registry-save"><input name="reason" placeholder="Reason for change" aria-label="Reason for ${escapeHtml(item.friendlyName)} change"><button class="btn btn-primary btn-compact" type="submit" disabled>Save squad</button><small data-registry-status aria-live="polite">${item.lastVerifiedAt ? `Verified ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : boardCandidates.length ? 'Database suggestion ready for review' : 'Not yet verified'}</small></div></div></form>`;
}

function render() {
  mount.innerHTML = `<div class="registry-head"><div><p class="surface-eyebrow">Organization truth</p><h2 id="governance-registry-title">PI participation and owner routes</h2><p>Review one squad at a time. Database suggestions reduce typing; only an authorized, reasoned save changes PI totals.</p></div><span>Registry v${Number(registry.version) || 1}</span></div><div class="registry-list">${(registry.squads || []).map(row).join('')}</div>`;
  mount.querySelectorAll('[data-registry-squad]').forEach((form) => {
    form.addEventListener('submit', save);
    form.querySelector('[data-registry-edit]')?.addEventListener('click', (event) => {
      mount.querySelectorAll('.registry-editor').forEach((editor) => { if (editor !== form.querySelector('.registry-editor')) editor.hidden = true; });
      const editor = form.querySelector('.registry-editor');
      editor.hidden = !editor.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!editor.hidden));
      if (!editor.hidden) editor.querySelector('select,input')?.focus();
    });
    form.addEventListener('input', () => {
      form.querySelector('[type="submit"]').disabled = false;
      form.querySelector('[data-registry-status]').textContent = 'Unsaved organization change.';
    });
  });
}

async function save(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('[data-registry-status]');
  const data = new FormData(form);
  const reason = String(data.get('reason') || '').trim();
  if (!reason) { status.textContent = 'Add a reason so the organization change is auditable.'; form.elements.reason.focus(); return; }
  const body = { participationState: data.get('participationState'), productOwner: data.get('productOwner') ? { displayName: data.get('productOwner') } : null, scrumMaster: data.get('scrumMaster') ? { displayName: data.get('scrumMaster') } : null, streamLead: data.get('streamLead') ? { displayName: data.get('streamLead') } : null, reason };
  form.querySelector('[type="submit"]').disabled = true; status.textContent = 'Saving organization truth…';
  const response = await fetch(`/api/governance/registry/${encodeURIComponent(form.dataset.registrySquad)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${registry.version}"` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (response.status === 412) { status.textContent = result.error || 'Settings changed elsewhere. Your draft is preserved; reload latest values.'; form.querySelector('[type="submit"]').disabled = false; return; }
  if (!response.ok) { status.textContent = result.error || 'Save failed. No organization truth was changed.'; form.querySelector('[type="submit"]').disabled = false; return; }
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
