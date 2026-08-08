import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer, closeRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';

const mount = document.getElementById('gov-settings-registry-mount');
let registry = null;
const drafts = new Map();

function personName(value) { return typeof value === 'string' ? value : value?.displayName || value?.name || ''; }
function normalized(value) { return String(value || '').trim(); }
function hasOwnerGap(item) { return !personName(item.productOwner) || !personName(item.scrumMaster); }
function isParticipationException(item) { return normalized(item.participationState) !== 'pi-governed'; }

function snapshot(item) {
  return {
    participationState: normalized(item.participationState),
    productOwner: normalized(personName(item.productOwner)),
    scrumMaster: normalized(personName(item.scrumMaster)),
    streamLead: normalized(personName(item.streamLead)),
    boardMapping: Array.isArray(item.boardMapping) ? item.boardMapping.map(Number).filter(Boolean) : [],
  };
}

function formValues(form) {
  const boardRaw = normalized(form.elements.boardMapping?.value);
  const boardMapping = boardRaw
    ? boardRaw.split(/[,\s]+/).map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  return {
    participationState: normalized(form.elements.participationState?.value),
    productOwner: normalized(form.elements.productOwner?.value),
    scrumMaster: normalized(form.elements.scrumMaster?.value),
    streamLead: normalized(form.elements.streamLead?.value),
    boardMapping,
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
  const ownerRoute = hasOwnerGap(item)
    ? 'Owner route incomplete'
    : `${personName(item.productOwner)} · ${personName(item.scrumMaster)}`;
  const boardIds = Array.isArray(item.boardMapping) ? item.boardMapping.join(', ') : '';
  const boardSuggestLabel = boardCandidates.slice(0, 2).map((board) => board.name || board.id).join(' · ');
  return `<form class="registry-row registry-row--compact" data-registry-squad="${escapeHtml(item.squadKey)}" data-registry-revision="${Number(item.revision) || 1}" data-original="${original}">
    <label class="registry-select" title="Select for one atomic organization change"><input type="checkbox" data-registry-select aria-label="Select ${escapeHtml(item.friendlyName)}"></label>
    <div class="registry-identity"><strong>${escapeHtml(item.friendlyName)}</strong><small>${escapeHtml(item.squadKey)} · ${escapeHtml(item.participationState.replace(/-/g, ' '))} · ${escapeHtml(boardCopy)}</small></div>
    <div class="registry-route-summary"><span>${escapeHtml(ownerRoute)}</span></div>
    <button class="registry-disclosure" type="button" data-registry-edit aria-expanded="false" aria-label="Edit ${escapeHtml(item.friendlyName)}" title="Edit ${escapeHtml(item.friendlyName)}"><span aria-hidden="true">›</span></button>
    <div class="registry-editor" hidden>
      <label><span>Participation</span><select name="participationState"><option value="pi-governed" ${item.participationState === 'pi-governed' ? 'selected' : ''}>PI-governed</option><option value="pending-consent" ${item.participationState === 'pending-consent' ? 'selected' : ''}>Pending consent</option><option value="operational-exception" ${item.participationState === 'operational-exception' ? 'selected' : ''}>Operational exception</option></select></label>
      <label><span>Product Owner</span><input name="productOwner" autocomplete="off" data-1p-ignore data-lpignore="true" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.productOwner))}" placeholder="Not assigned"></label>
      <label><span>Scrum Master</span><input name="scrumMaster" autocomplete="off" data-1p-ignore data-lpignore="true" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.scrumMaster))}" placeholder="Not assigned"></label>
      <label><span>Stream lead</span><input name="streamLead" autocomplete="off" data-1p-ignore data-lpignore="true" list="people-${escapeHtml(item.squadKey)}" value="${escapeHtml(personName(item.streamLead))}" placeholder="Not assigned"></label>
      <label><span>Board IDs</span><input name="boardMapping" autocomplete="off" data-1p-ignore data-lpignore="true" value="${escapeHtml(boardIds)}" placeholder="e.g. 230" aria-label="Board mapping for ${escapeHtml(item.friendlyName)}"></label>
      <datalist id="people-${escapeHtml(item.squadKey)}">${peopleOptions}</datalist>
      ${people.length ? `<div class="registry-suggestion-bar"><button type="button" class="btn btn-link btn-compact" data-accept-suggestion>Accept people suggestion</button><small>${escapeHtml(people.slice(0, 2).map((p) => p.displayName).join(' · '))}</small></div>` : ''}
      ${boardCandidates.length ? `<div class="registry-suggestion-bar"><button type="button" class="btn btn-link btn-compact" data-accept-board-suggestion>Accept board suggestion</button><small>${escapeHtml(boardSuggestLabel)}</small></div>` : ''}
      <div class="registry-save"><input name="reason" autocomplete="off" data-1p-ignore data-lpignore="true" placeholder="Reason for change" aria-label="Reason for ${escapeHtml(item.friendlyName)} change"><button class="btn btn-primary btn-compact" type="submit" disabled>Save squad</button><small data-registry-status aria-live="polite">${item.lastVerifiedAt ? `Verified ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : boardCandidates.length ? 'Database suggestions ready for review' : 'Not yet verified'}</small></div>
    </div>
  </form>`;
}

function auditHistory() {
  const entries = (registry.auditHistory || []).slice(0, 5);
  if (!entries.length) return '<p>No organization changes recorded yet.</p>';
  return `<ol class="registry-audit-list">${entries.map((entry) => `<li><strong>${escapeHtml(entry.squadKeys?.join(', ') || 'Organization')}</strong><span>${escapeHtml(entry.reason || 'Reason unavailable')}</span><small>${escapeHtml(new Date(entry.at).toLocaleString())} · ${escapeHtml(entry.actor || 'authorized admin')}</small></li>`).join('')}</ol>`;
}

function renderBand(title, description, items, emptyCopy = 'Nothing to review right now.') {
  return `<section class="registry-band"><header class="registry-band-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><span>${items.length}</span></header>${items.length ? `<div class="registry-list">${items.map(row).join('')}</div>` : `<p class="governance-empty">${escapeHtml(emptyCopy)}</p>`}</section>`;
}

function render() {
  const squads = registry.squads || [];
  const participationExceptions = squads.filter(isParticipationException);
  const ownerRouteGaps = squads.filter((item) => !isParticipationException(item) && hasOwnerGap(item));
  const platformHealthy = squads.filter((item) => !isParticipationException(item) && !hasOwnerGap(item));
  // Band headers carry counts — drop duplicate health-strip KPI tiles. Bulk stays folded.
  mount.innerHTML = `<div class="registry-head"><div><p class="surface-eyebrow">Organization truth</p><h2 id="governance-registry-title">PI participation and owner routes</h2><p>Change participation once, close owner-route gaps fast, and publish trusted organization truth across Delivera.</p><p class="registry-find-hint" data-registry-find-hint>Press <kbd>/</kbd> or use top chrome <strong>Find squad</strong> to filter exceptions.</p></div><span>Registry v${Number(registry.version) || 1}</span></div>
    <label class="registry-filter registry-filter--sr-only">Find squad<input type="search" data-registry-filter placeholder="Name, key, owner, or state" aria-hidden="true" tabindex="-1"></label>
    ${renderBand('Participation exceptions', 'These squads are excluded or pending onboarding, so this band should stay intentionally small.', participationExceptions, 'No participation exceptions are active.')}
    ${renderBand('Owner-route gaps', 'Fix missing PO and SM routes before the full registry list so actions can land on the right people.', ownerRouteGaps, 'All visible squads have PO and SM routes.')}
    <details class="registry-bulk" aria-labelledby="registry-bulk-title"><summary id="registry-bulk-title">Bulk participation change <span data-selected-count>0 squads selected</span></summary><div class="registry-bulk-body"><p>Updates are atomic and auditable.</p><button type="button" class="btn btn-link btn-compact" data-select-pending>Select pending consent</button><label>New participation<select data-bulk-participation><option value="">Keep current</option><option value="pi-governed">PI-governed</option><option value="pending-consent">Pending consent</option><option value="operational-exception">Operational exception</option></select></label><label>Reason<input data-bulk-reason autocomplete="off" data-1p-ignore data-lpignore="true" placeholder="Why this organization policy is changing"></label><button type="button" class="btn btn-primary" data-bulk-preview disabled>Preview and apply</button><p data-bulk-status role="status" aria-live="polite"></p></div></details>
    ${renderBand('Platform health / audit', 'Healthy squads remain editable here, but the first attention should go to the exception and owner-gap bands above.', platformHealthy, 'No fully routed PI-governed squads are available yet.')}
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
    form.querySelector('[data-accept-suggestion]')?.addEventListener('click', () => {
      const squad = registry.squads.find((item) => item.squadKey === form.dataset.registrySquad);
      const people = squad?.suggestions?.people || [];
      if (!people.length) return;
      const po = people.find((p) => /product owner|po/i.test(String(p.role || p.evidence || ''))) || people[0];
      const sm = people.find((p) => /scrum master|sm/i.test(String(p.role || p.evidence || ''))) || people[1] || people[0];
      if (form.elements.productOwner && !normalized(form.elements.productOwner.value) && po?.displayName) {
        form.elements.productOwner.value = po.displayName;
      }
      if (form.elements.scrumMaster && !normalized(form.elements.scrumMaster.value) && sm?.displayName) {
        form.elements.scrumMaster.value = sm.displayName;
      }
      if (!normalized(form.elements.reason?.value)) form.elements.reason.value = 'Accepted registry people suggestion';
      updateRowState(form);
      const status = form.querySelector('[data-registry-status]');
      if (status) status.textContent = 'Suggestion applied — review and save.';
    });
    form.querySelector('[data-accept-board-suggestion]')?.addEventListener('click', () => {
      const squad = registry.squads.find((item) => item.squadKey === form.dataset.registrySquad);
      const boards = squad?.suggestions?.boardMapping || [];
      if (!boards.length || !form.elements.boardMapping) return;
      const ids = boards.map((board) => Number(board.id || board.boardId || board)).filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return;
      form.elements.boardMapping.value = ids.join(', ');
      if (!normalized(form.elements.reason?.value)) form.elements.reason.value = 'Accepted registry board suggestion';
      updateRowState(form);
      const status = form.querySelector('[data-registry-status]');
      if (status) status.textContent = 'Board suggestion applied — review and save.';
    });
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
    boardMapping: Array.isArray(values.boardMapping) ? values.boardMapping : [],
  };
}

function broadcastRegistryVersion(version) {
  try {
    const nextVersion = String(version || Date.now());
    localStorage.setItem('delivera:registry-version', nextVersion);
    // storage events do not fire in the same tab, so notify local listeners too.
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'delivera:registry-version',
      newValue: nextVersion,
      oldValue: null,
    }));
  } catch (_) {}
  // Wipe ActiveLoop / sprint client caches so Governance + Sprint pick up org truth without user reset.
  try {
    import('./Delivera-Shared-Release-Cache-Guard-01SSOT.js')
      .then((mod) => { if (typeof mod.clearGovernanceClientCaches === 'function') mod.clearGovernanceClientCaches(); })
      .catch(() => {});
  } catch (_) { /* ignore */ }
  try {
    import('./Delivera-App-Governance-ActiveLoop-01UI.js?v=20260729k')
      .then((mod) => { if (typeof mod.clearActiveLoopCaches === 'function') mod.clearActiveLoopCaches(); })
      .catch(() => {});
  } catch (_) { /* ignore */ }
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
  const button = form.querySelector('[type="submit"]');
  const values = formValues(form);
  const squadKey = form.dataset.registrySquad;
  const previous = registry.squads.find((item) => item.squadKey === squadKey);
  // Optimistic local paint — keep the registry visible while publishing.
  if (previous) {
    Object.assign(previous, values);
    form.dataset.original = JSON.stringify(snapshot(previous));
    const summary = form.querySelector('.registry-route-summary');
    if (summary) summary.innerHTML = `<span>${escapeHtml(values.productOwner && values.scrumMaster ? `${values.productOwner} · ${values.scrumMaster}` : 'Owner route incomplete')}</span>`;
  }
  button.disabled = true;
  status.textContent = 'Publishing organization truth…';
  try {
    registry = await requestBatch([{ squadKey, expectedRevision: Number(form.dataset.registryRevision) || 1, patch: patchFromValues(values) }], reason);
    broadcastRegistryVersion(registry.version);
    drafts.delete(squadKey);
    const receipt = registry.receipt?.id ? ` Receipt ${registry.receipt.id}.` : '';
    render();
    const refreshed = mount.querySelector(`[data-registry-squad="${squadKey}"] [data-registry-status]`);
    if (refreshed) refreshed.textContent = `Saved across Delivera.${receipt}`;
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
    broadcastRegistryVersion(registry.version);
    drafts.clear(); render();
    mount.querySelector('[data-bulk-status]').textContent = `${names.length} squads updated across Delivera. Receipt ${registry.receipt?.id || 'recorded'}.`;
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
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeRightDrawer();
      resolve(result);
    };
    const { el } = openRightDrawer({
      title: 'Preview organization change',
      panelClass: 'registry-bulk',
      bodyHtml: `<section class="gov-resolution-sheet">
          <p><strong>${escapeHtml(names.length)} squad${names.length === 1 ? '' : 's'}</strong> will move to <strong>${escapeHtml(participationState.replace(/-/g, ' '))}</strong>.</p>
          <ul class="gov-bulk-preview-list">${names.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
          <p><small>Reason: ${escapeHtml(reason)}</small></p>
          <div class="gov-bulk-preview-actions">
            <button type="button" class="btn btn-primary" data-bulk-apply>Apply</button>
            <button type="button" class="btn btn-link" data-bulk-cancel>Cancel</button>
          </div>
        </section>`,
      onClose: () => finish(false),
    });
    el.querySelector('[data-bulk-apply]')?.addEventListener('click', () => finish(true));
    el.querySelector('[data-bulk-cancel]')?.addEventListener('click', () => finish(false));
    el.querySelector('[data-bulk-apply]')?.focus();
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
