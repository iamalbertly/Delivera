import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

const mount = document.getElementById('gov-settings-registry-mount');
let registry = null;
const drafts = new Map();

function personName(value) { return typeof value === 'string' ? value : value?.displayName || value?.name || ''; }
function normalized(value) { return String(value || '').trim(); }

function snapshot(item) {
  return {
    participationState: normalized(item.participationState),
    productOwner: normalized(personName(item.productOwner)),
    scrumMaster: normalized(personName(item.scrumMaster)),
    streamLead: normalized(personName(item.streamLead)),
  };
}

function formValues(form) {
  return {
    participationState: normalized(form.elements.participationState?.value),
    productOwner: normalized(form.elements.productOwner?.value),
    scrumMaster: normalized(form.elements.scrumMaster?.value),
    streamLead: normalized(form.elements.streamLead?.value),
  };
}

function isDirty(form) {
  const original = JSON.parse(form.dataset.original || '{}');
  return JSON.stringify(formValues(form)) !== JSON.stringify(original);
}

function row(item) {
  const boardCandidates = item.suggestions?.boardMapping || [];
  const people = item.suggestions?.people || [];
  const peopleOptions = people.map((person) => `<option value="${escapeHtml(person.displayName)}">${escapeHtml(`${person.confidence || 'observed'} · ${person.evidence || ''}`)}</option>`).join('');
  const boardCopy = item.boardMapping?.length ? `Boards ${item.boardMapping.join(', ')}` : boardCandidates.length ? `Suggested: ${boardCandidates.map((board) => board.name).join(', ')}` : 'Board mapping not confirmed';
  const original = escapeHtml(JSON.stringify(snapshot(item)));
  return `<form class="registry-row registry-row--compact" data-registry-squad="${escapeHtml(item.squadKey)}" data-registry-revision="${Number(item.revision) || 1}" data-original="${original}">
    <label class="registry-select" title="Select for one atomic organization change"><input type="checkbox" data-registry-select aria-label="Select ${escapeHtml(item.friendlyName)}"></label>
    <div class="registry-identity"><strong>${escapeHtml(item.friendlyName)}</strong><small>${escapeHtml(item.squadKey)} · ${escapeHtml(item.participationState.replace(/-/g, ' '))} · ${escapeHtml(boardCopy)}</small></div>
    <div class="registry-route-summary"><span>${escapeHtml(personName(item.productOwner) || 'PO unresolved')}</span><span>${escapeHtml(personName(item.scrumMaster) || 'SM unresolved')}</span></div>
    <button class="btn btn-secondary btn-compact" type="button" data-registry-edit aria-expanded="false">Review squad</button>
    <div class="registry-editor" hidden>
      <label><span>Participation</span><select name="participationState"><option value="pi-governed" ${item.participationState === 'pi-governed' ? 'selected' : ''}>PI-governed</option><option value="pending-consent" ${item.participationState === 'pending-consent' ? 'selected' : ''}>Pending consent</option><option value="operational-exception" ${item.participationState === 'operational-exception' ? 'selected' : ''}>Operational exception</option></select></label>
      <label><span>Product Owner</span><input name="productOwner" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.productOwner))}" placeholder="Not assigned"></label>
      <label><span>Scrum Master</span><input name="scrumMaster" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.scrumMaster))}" placeholder="Not assigned"></label>
      <label><span>Stream lead</span><input name="streamLead" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.streamLead))}" placeholder="Not assigned"></label>
      <datalist id="people-${escapeHtml(item.squadKey)}">${peopleOptions}</datalist>
      <div class="registry-save"><input name="reason" placeholder="Reason for change" aria-label="Reason for ${escapeHtml(item.friendlyName)} change"><button class="btn btn-primary btn-compact" type="submit" disabled>Save squad</button><small data-registry-status aria-live="polite">${item.lastVerifiedAt ? `Verified ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : boardCandidates.length ? 'Database suggestions ready for review' : 'Not yet verified'}</small></div>
    </div>
  </form>`;
}

function auditHistory() {
  const entries = (registry.auditHistory || []).slice(0, 5);
  if (!entries.length) return '<p>No organization changes recorded yet.</p>';
  return `<ol class="registry-audit-list">${entries.map((entry) => `<li><strong>${escapeHtml(entry.squadKeys?.join(', ') || 'Organization')}</strong><span>${escapeHtml(entry.reason || 'Reason unavailable')}</span><small>${escapeHtml(new Date(entry.at).toLocaleString())} · ${escapeHtml(entry.actor || 'authorized admin')}</small></li>`).join('')}</ol>`;
}

function render() {
  mount.innerHTML = `<div class="registry-head"><div><p class="surface-eyebrow">Organization truth</p><h2 id="governance-registry-title">PI participation and owner routes</h2><p>Select squads once, preview one reasoned change, and publish it across Delivera.</p></div><label class="registry-filter">Find squad<input type="search" data-registry-filter placeholder="Name, key, owner, or state"></label><span>Registry v${Number(registry.version) || 1}</span></div>
    <section class="registry-bulk" aria-labelledby="registry-bulk-title"><div><h3 id="registry-bulk-title">Bulk participation change</h3><p><span data-selected-count>0 squads selected</span> · updates are atomic and auditable.</p></div><button type="button" class="btn btn-link btn-compact" data-select-pending>Select pending consent</button><label>New participation<select data-bulk-participation><option value="">Keep current</option><option value="pi-governed">PI-governed</option><option value="pending-consent">Pending consent</option><option value="operational-exception">Operational exception</option></select></label><label>Reason<input data-bulk-reason placeholder="Why this organization policy is changing"></label><button type="button" class="btn btn-primary" data-bulk-preview disabled>Preview and apply</button><p data-bulk-status role="status" aria-live="polite"></p></section>
    <div class="registry-list">${(registry.squads || []).map(row).join('')}</div>
    <details class="registry-audit"><summary>Recent organization changes</summary>${auditHistory()}</details>`;
  wireRows();
  wireBulk();
  mount.querySelector('[data-registry-filter]')?.addEventListener('input', filterRows);
}

function filterRows(event) {
  const query = normalized(event.currentTarget.value).toLowerCase();
  mount.querySelectorAll('[data-registry-squad]').forEach((form) => {
    form.hidden = Boolean(query) && !form.textContent.toLowerCase().includes(query);
  });
}

function updateRowState(form) {
  const dirty = isDirty(form);
  const reason = normalized(form.elements.reason?.value);
  const saveButton = form.querySelector('[type="submit"]');
  if (saveButton) saveButton.disabled = !dirty || !reason;
  const status = form.querySelector('[data-registry-status]');
  if (status) status.textContent = dirty ? (reason ? 'Organization change ready to save.' : 'Add a reason to save this change.') : 'No unsaved change.';
  drafts.set(form.dataset.registrySquad, { values: formValues(form), reason });
}

function wireRows() {
  mount.querySelectorAll('[data-registry-squad]').forEach((form) => {
    const draft = drafts.get(form.dataset.registrySquad);
    if (draft) Object.entries(draft.values || {}).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value; });
    form.addEventListener('submit', saveOne);
    form.querySelector('[data-registry-edit]')?.addEventListener('click', (event) => {
      const editor = form.querySelector('.registry-editor');
      editor.hidden = !editor.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!editor.hidden));
      if (!editor.hidden) editor.querySelector('select,input')?.focus();
    });
    form.addEventListener('input', () => updateRowState(form));
    form.querySelector('[data-registry-select]')?.addEventListener('change', updateBulkState);
    updateRowState(form);
  });
}

function selectedForms() { return [...mount.querySelectorAll('[data-registry-squad]')].filter((form) => form.querySelector('[data-registry-select]')?.checked); }

function updateBulkState() {
  const selected = selectedForms();
  const reason = normalized(mount.querySelector('[data-bulk-reason]')?.value);
  const participation = normalized(mount.querySelector('[data-bulk-participation]')?.value);
  mount.querySelector('[data-selected-count]').textContent = `${selected.length} squad${selected.length === 1 ? '' : 's'} selected`;
  // Auto-suggest: if squads are selected but participation not yet chosen, default to 'pi-governed'
  if (selected.length && !participation) {
    const select = mount.querySelector('[data-bulk-participation]');
    if (select && select.value !== 'pi-governed') {
      select.value = 'pi-governed';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return; // re-run updateBulkState via the change listener
    }
  }
  // Auto-suggest: if squads are selected but reason is empty, pre-fill a default reason
  if (selected.length && !reason) {
    const reasonInput = mount.querySelector('[data-bulk-reason]');
    if (reasonInput && !reasonInput.dataset.autoFilled) {
      reasonInput.value = 'Onboarding into PI governance';
      reasonInput.dataset.autoFilled = '1';
      reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
      return; // re-run updateBulkState via the input listener
    }
  }
  mount.querySelector('[data-bulk-preview]').disabled = !selected.length || !reason || !participation;
}

function wireBulk() {
  mount.querySelector('[data-select-pending]')?.addEventListener('click', () => {
    mount.querySelectorAll('[data-registry-squad]').forEach((form) => {
      const item = registry.squads.find((squad) => squad.squadKey === form.dataset.registrySquad);
      form.querySelector('[data-registry-select]').checked = item?.participationState === 'pending-consent';
    });
    updateBulkState();
  });
  mount.querySelector('[data-bulk-reason]')?.addEventListener('input', updateBulkState);
  mount.querySelector('[data-bulk-participation]')?.addEventListener('change', updateBulkState);
  mount.querySelector('[data-bulk-preview]')?.addEventListener('click', saveBulk);
  updateBulkState();
}

function patchFromValues(values) {
  return {
    participationState: values.participationState,
    productOwner: values.productOwner ? { displayName: values.productOwner } : null,
    scrumMaster: values.scrumMaster ? { displayName: values.scrumMaster } : null,
    streamLead: values.streamLead ? { displayName: values.streamLead } : null,
  };
}

async function requestBatch(changes, reason) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `registry-${Date.now()}`;
  const response = await fetch('/api/governance/registry', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ changes, reason, idempotencyKey }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || 'No organization truth was changed.'), { result, status: response.status });
  return result;
}

async function saveOne(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('[data-registry-status]');
  const reason = normalized(form.elements.reason?.value);
  if (!isDirty(form) || !reason) return updateRowState(form);
  const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = 'Publishing organization truth…';
  try {
    registry = await requestBatch([{ squadKey: form.dataset.registrySquad, expectedRevision: Number(form.dataset.registryRevision) || 1, patch: patchFromValues(formValues(form)) }], reason);
    drafts.delete(form.dataset.registrySquad); render();
  } catch (error) {
    updateRowState(form);
    status.textContent = error.status === 412 ? `${error.message} Your draft is preserved.` : error.message;
  }
}

async function saveBulk() {
  const forms = selectedForms();
  const participationState = normalized(mount.querySelector('[data-bulk-participation]').value);
  const reason = normalized(mount.querySelector('[data-bulk-reason]').value);
  const status = mount.querySelector('[data-bulk-status]');
  const button = mount.querySelector('[data-bulk-preview]');
  const names = forms.map((form) => registry.squads.find((item) => item.squadKey === form.dataset.registrySquad)?.friendlyName || form.dataset.registrySquad);
  // In-app preview drawer (replaces native confirm() for consistent UX)
  const confirmed = await showBulkPreviewDrawer({ participationState, names, reason });
  if (!confirmed) return;
  button.disabled = true; status.textContent = 'Publishing one atomic organization change…';
  try {
    const changes = forms.map((form) => ({ squadKey: form.dataset.registrySquad, expectedRevision: Number(form.dataset.registryRevision) || 1, patch: { participationState } }));
    registry = await requestBatch(changes, reason);
    drafts.clear(); render();
    mount.querySelector('[data-bulk-status]').textContent = `${names.length} squads updated across Delivera. Receipt ${registry.receipt?.id || 'recorded'}.`;
    // Broadcast to other tabs via storage event + same-tab refresh
    try {
      const version = String(registry.version || Date.now());
      localStorage.setItem('delivera:registry-version', version);
      // storage event doesn't fire in the same tab — dispatch manually
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'delivera:registry-version',
        newValue: version,
        oldValue: null,
      }));
    } catch (_) {}
  } catch (error) {
    status.textContent = error.status === 412 ? `${error.message} No squad was changed.` : error.message;
    updateBulkState();
  }
}

/**
 * In-app preview drawer replacing the native confirm() dialog.
 * Returns a Promise<boolean> — true if user clicks Apply, false on Cancel/close.
 */
function showBulkPreviewDrawer({ participationState, names, reason }) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'gov-right-drawer-host';
    host.innerHTML = `
      <div class="gov-right-drawer-backdrop" data-drawer-close></div>
      <aside class="gov-right-drawer-panel" role="dialog" aria-labelledby="bulk-preview-title">
        <header class="gov-right-drawer-head">
          <h2 id="bulk-preview-title" class="gov-right-drawer-title">Preview organization change</h2>
          <button type="button" class="btn btn-link btn-compact" data-drawer-close aria-label="Close">Close</button>
        </header>
        <div class="gov-right-drawer-body">
          <p><strong>${escapeHtml(names.length)} squad${names.length === 1 ? '' : 's'}</strong> will move to <strong>${escapeHtml(participationState.replace(/-/g, ' '))}</strong>.</p>
          <ul class="gov-bulk-preview-list">${names.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
          <p><small>Reason: ${escapeHtml(reason)}</small></p>
          <div class="gov-bulk-preview-actions">
            <button type="button" class="btn btn-primary" data-bulk-apply>Apply</button>
            <button type="button" class="btn btn-link" data-drawer-close>Cancel</button>
          </div>
        </div>
      </aside>`;
    document.body.appendChild(host);
    document.body.classList.add('gov-right-drawer-open');
    const cleanup = (result) => {
      host.remove();
      document.body.classList.remove('gov-right-drawer-open');
      resolve(result);
    };
    host.querySelector('[data-bulk-apply]')?.addEventListener('click', () => cleanup(true));
    host.querySelectorAll('[data-drawer-close]').forEach((btn) => btn.addEventListener('click', () => cleanup(false)));
    host.querySelector('[data-bulk-apply]')?.focus();
  });
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
