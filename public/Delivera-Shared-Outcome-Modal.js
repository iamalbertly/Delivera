import { createModalBehavior } from './Delivera-Core-UI-02Primitives-Modal.js';
import { isJiraIssueKey } from './Delivera-Report-Utils-Jira-Helpers.js';
import { OUTCOME_STRUCTURE_MODE, parseOutcomeIntake } from './Delivera-Shared-Outcome-Intake-Parser.js';

let modalController = null;
let currentConfig = {};
const LAST_OUTCOME_PROJECT_KEY = 'report_last_outcome_project_v1';
const outcomeComposerState = {
  structureMode: 'AUTO',
  parentIndex: 0,
  issueTypeName: '',
  childIssueTypeName: '',
  showAdvanced: false,
  inputMode: 'mixed',
};
/** @type {{ payload: object|null, warningsOnly: boolean }} */
let outcomeDraftState = { payload: null, warningsOnly: false };

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findFirstJiraKey(text) {
  if (!text || typeof text !== 'string') return '';
  const tokens = text.split(/[\s,;()\[\]{}<>]+/);
  for (const raw of tokens) {
    const token = String(raw || '').trim();
    if (token && isJiraIssueKey(token)) return token.toUpperCase();
  }
  return '';
}

function saveLastOutcomeProject(projectKey) {
  try {
    if (projectKey) window.localStorage.setItem(LAST_OUTCOME_PROJECT_KEY, projectKey);
  } catch (_) {}
}

function readLastOutcomeProject() {
  try {
    return window.localStorage.getItem(LAST_OUTCOME_PROJECT_KEY) || '';
  } catch (_) {
    return '';
  }
}

function ensureOutcomeModal() {
  let modal = document.getElementById('global-outcome-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'global-outcome-modal';
  modal.className = 'scope-modal-overlay global-outcome-modal';
  modal.style.display = 'none';
  modal.innerHTML = ''
    + '<div class="scope-modal-content global-outcome-modal-content" role="dialog" aria-modal="true" aria-labelledby="global-outcome-modal-title">'
    + '<div class="modal-header">'
    + '<div>'
    + '<h3 id="global-outcome-modal-title">Create Jira work from this narrative</h3>'
    + '<p id="global-outcome-modal-context" class="report-outcome-intake-hint">Promote a narrative, risk, or board signal into trackable Jira work.</p>'
    + '</div>'
    + '<button type="button" class="modal-close-btn" data-modal-close aria-label="Close outcome modal">x</button>'
    + '</div>'
    + '<div class="modal-body">'
    + '<div class="report-outcome-intake-inner">'
    + '<div class="report-outcome-intake-header">'
    + '<p class="report-outcome-intake-title">Outcome narrative</p>'
    + '<p id="global-outcome-projects-line" class="report-outcome-intake-hint"></p>'
    + '</div>'
    + '<div id="global-outcome-project-picker-wrap" class="global-outcome-project-picker-wrap" hidden>'
    + '<label class="insight-label" for="global-outcome-project-picker">Primary project</label>'
    + '<select id="global-outcome-project-picker" class="insight-inline-input" aria-label="Choose primary project"></select>'
    + '<p id="global-outcome-project-picker-hint" class="report-outcome-intake-hint"></p>'
    + '</div>'
    + '<textarea id="report-outcome-text" class="report-outcome-text" rows="5" placeholder="Goal: ... As a ... I want ... So that ... Acceptance criteria: ..." aria-label="Outcome story narrative"></textarea>'
    + '<div class="report-outcome-input-mode-row" role="group" aria-label="Input kind">'
    + '<span class="report-outcome-input-mode-label">Input:</span>'
    + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="mixed" checked> Mixed notes</label>'
    + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="quarterly"> Quarterly</label>'
    + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="support"> Support</label>'
    + '</div>'
    + '<div id="report-outcome-overrides" class="report-outcome-overrides" hidden></div>'
    + '<div id="report-outcome-parse-summary" class="report-outcome-parse-summary" hidden></div>'
    + '<div id="report-outcome-draft-panel" class="report-outcome-draft-panel" hidden>'
    + '<div id="report-outcome-draft-precheck" class="report-outcome-draft-precheck" role="status"></div>'
    + '<div id="report-outcome-readiness" class="report-outcome-readiness" hidden></div>'
    + '<label class="insight-label report-outcome-parent-label" for="report-outcome-parent-summary-override">Parent / epic title override</label>'
    + '<input type="text" id="report-outcome-parent-summary-override" class="insight-inline-input report-outcome-parent-summary-override" placeholder="Leave blank to use server suggestion" />'
    + '<div class="report-outcome-draft-bulk">'
    + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-accept-safe">Accept all safe</button>'
    + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-review-warnings">Review warnings only</button>'
    + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-cancel-draft">Cancel draft</button>'
    + '</div>'
    + '<div class="report-outcome-draft-table-wrap"><table class="report-outcome-draft-table" id="report-outcome-draft-table" aria-label="Draft rows"><thead><tr><th></th><th>Title</th><th>Confidence</th><th>Notes</th><th></th></tr></thead><tbody id="report-outcome-draft-tbody"></tbody></table></div>'
    + '</div>'
    + '<div class="report-outcome-intake-actions report-outcome-intake-actions-split">'
    + '<span id="report-outcome-intake-status" class="report-outcome-intake-status" aria-live="polite"></span>'
    + '<div class="report-outcome-intake-actions-buttons">'
    + '<button type="button" id="report-outcome-generate-draft" class="btn btn-secondary btn-compact" disabled>Generate draft</button>'
    + '<button type="button" id="report-outcome-commit-selected" class="btn btn-compact report-outcome-intake-create-btn" disabled hidden>Create selected</button>'
    + '<button type="button" id="report-outcome-intake-create" class="btn btn-compact report-outcome-intake-create-btn" disabled>Create Jira work</button>'
    + '</div></div>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
  return modal;
}

function patchLegacyOutcomeModalDom(modal) {
  if (!modal || modal.dataset.outcomeDraftPatched === '1') return;
  if (modal.querySelector('#report-outcome-draft-panel')) {
    modal.dataset.outcomeDraftPatched = '1';
    return;
  }
  const ta = modal.querySelector('#report-outcome-text');
  if (ta && !modal.querySelector('.report-outcome-input-mode-row')) {
    ta.insertAdjacentHTML('afterend', ''
      + '<div class="report-outcome-input-mode-row" role="group" aria-label="Input kind">'
      + '<span class="report-outcome-input-mode-label">Input:</span>'
      + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="mixed" checked> Mixed</label>'
      + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="quarterly"> Quarterly</label>'
      + '<label class="report-outcome-mode-chip"><input type="radio" name="report-outcome-input-mode" value="support"> Support</label>'
      + '</div>');
  }
  const summary = modal.querySelector('#report-outcome-parse-summary');
  if (summary && !modal.querySelector('#report-outcome-draft-panel')) {
    summary.insertAdjacentHTML('afterend', ''
      + '<div id="report-outcome-draft-panel" class="report-outcome-draft-panel" hidden>'
      + '<div id="report-outcome-draft-precheck" class="report-outcome-draft-precheck" role="status"></div>'
      + '<div id="report-outcome-readiness" class="report-outcome-readiness" hidden></div>'
      + '<label class="insight-label report-outcome-parent-label" for="report-outcome-parent-summary-override">Parent / epic title override</label>'
      + '<input type="text" id="report-outcome-parent-summary-override" class="insight-inline-input report-outcome-parent-summary-override" placeholder="Optional" />'
      + '<div class="report-outcome-draft-bulk">'
      + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-accept-safe">Accept all safe</button>'
      + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-review-warnings">Review warnings only</button>'
      + '<button type="button" class="btn btn-secondary btn-compact" id="report-outcome-cancel-draft">Cancel draft</button>'
      + '</div>'
      + '<div class="report-outcome-draft-table-wrap"><table class="report-outcome-draft-table" id="report-outcome-draft-table" aria-label="Draft rows"><thead><tr><th></th><th>Title</th><th>Confidence</th><th>Notes</th><th></th></tr></thead><tbody id="report-outcome-draft-tbody"></tbody></table></div>'
      + '</div>');
  }
  const actions = modal.querySelector('.report-outcome-intake-actions');
  const createBtn = modal.querySelector('#report-outcome-intake-create');
  if (actions && createBtn && !modal.querySelector('#report-outcome-generate-draft')) {
    actions.classList.add('report-outcome-intake-actions-split');
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.id = 'report-outcome-generate-draft';
    genBtn.className = 'btn btn-secondary btn-compact';
    genBtn.textContent = 'Generate draft';
    genBtn.disabled = true;
    const commitSel = document.createElement('button');
    commitSel.type = 'button';
    commitSel.id = 'report-outcome-commit-selected';
    commitSel.className = 'btn btn-compact report-outcome-intake-create-btn';
    commitSel.textContent = 'Create selected';
    commitSel.disabled = true;
    commitSel.hidden = true;
    const wrap = document.createElement('div');
    wrap.className = 'report-outcome-intake-actions-buttons';
    wrap.appendChild(genBtn);
    wrap.appendChild(commitSel);
    wrap.appendChild(createBtn);
    actions.appendChild(wrap);
  }
  modal.dataset.outcomeDraftPatched = '1';
}

function getElements() {
  const modal = ensureOutcomeModal();
  patchLegacyOutcomeModalDom(modal);
  return {
    modal,
    textarea: modal.querySelector('#report-outcome-text'),
    statusEl: modal.querySelector('#report-outcome-intake-status'),
    createBtn: modal.querySelector('#report-outcome-intake-create'),
    generateDraftBtn: modal.querySelector('#report-outcome-generate-draft'),
    commitSelectedBtn: modal.querySelector('#report-outcome-commit-selected'),
    draftPanel: modal.querySelector('#report-outcome-draft-panel'),
    draftPrecheck: modal.querySelector('#report-outcome-draft-precheck'),
    readinessEl: modal.querySelector('#report-outcome-readiness'),
    draftTbody: modal.querySelector('#report-outcome-draft-tbody'),
    parentSummaryOverride: modal.querySelector('#report-outcome-parent-summary-override'),
    contextEl: modal.querySelector('#global-outcome-modal-context'),
    projectsLineEl: modal.querySelector('#global-outcome-projects-line'),
    projectPickerWrap: modal.querySelector('#global-outcome-project-picker-wrap'),
    projectPicker: modal.querySelector('#global-outcome-project-picker'),
    projectPickerHint: modal.querySelector('#global-outcome-project-picker-hint'),
    overridesEl: modal.querySelector('#report-outcome-overrides'),
    parseSummaryEl: modal.querySelector('#report-outcome-parse-summary'),
  };
}

function getAllowedProjects(prefill = {}) {
  const selected = typeof currentConfig.getSelectedProjects === 'function' ? currentConfig.getSelectedProjects() : [];
  return Array.from(new Set([...(selected || []), ...(prefill.contextProjects || [])]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean)));
}

function setStatus(statusEl, message, isHtml = false) {
  if (!statusEl) return;
  if (isHtml) statusEl.innerHTML = message || '';
  else statusEl.textContent = message || '';
}

function setButtonState(button, disabled, label) {
  if (!button) return;
  button.disabled = !!disabled;
  button.textContent = label || 'Create Jira work';
}

function getDraftContextFromConfig() {
  const fn = currentConfig.getOutcomeDraftContext;
  if (typeof fn !== 'function') return { boardId: null, quarterHint: '' };
  try {
    const ctx = fn() || {};
    return {
      boardId: ctx.boardId != null ? Number(ctx.boardId) : null,
      quarterHint: String(ctx.quarterHint || ctx.quarterLabel || '').trim(),
    };
  } catch (_) {
    return { boardId: null, quarterHint: '' };
  }
}

function syncInputModeRadios() {
  const modal = document.getElementById('global-outcome-modal');
  if (!modal) return;
  modal.querySelectorAll('input[name="report-outcome-input-mode"]').forEach((el) => {
    if (el instanceof HTMLInputElement) el.checked = el.value === outcomeComposerState.inputMode;
  });
}

function hideDraftPanel() {
  const el = getElements();
  outcomeDraftState = { payload: null, warningsOnly: false };
  if (el.draftPanel) el.draftPanel.hidden = true;
  if (el.commitSelectedBtn) {
    el.commitSelectedBtn.hidden = true;
    el.commitSelectedBtn.disabled = true;
  }
  if (el.draftPrecheck) el.draftPrecheck.textContent = '';
  if (el.readinessEl) {
    el.readinessEl.hidden = true;
    el.readinessEl.innerHTML = '';
  }
  if (el.draftTbody) el.draftTbody.innerHTML = '';
  if (el.parentSummaryOverride) el.parentSummaryOverride.value = '';
}

function renderDraftPanel(payload) {
  const el = getElements();
  if (!el.draftPanel || !payload) return;
  outcomeDraftState.payload = payload;
  outcomeDraftState.warningsOnly = false;
  el.draftPanel.hidden = false;
  if (el.commitSelectedBtn) {
    el.commitSelectedBtn.hidden = false;
    el.commitSelectedBtn.disabled = false;
  }
  if (el.draftPrecheck) {
    el.draftPrecheck.textContent = payload.precheck?.message || '';
  }
  if (el.readinessEl) {
    const rw = Array.isArray(payload.readinessWarnings) ? payload.readinessWarnings : [];
    if (rw.length) {
      el.readinessEl.hidden = false;
      el.readinessEl.innerHTML = '<ul class="report-outcome-readiness-list">'
        + rw.map((w) => '<li>' + escapeHtml(w.message || w.code || '') + '</li>').join('')
        + '</ul>';
    } else {
      el.readinessEl.hidden = true;
      el.readinessEl.innerHTML = '';
    }
  }
  if (el.parentSummaryOverride && payload.epicHintDefault) {
    el.parentSummaryOverride.placeholder = payload.epicHintDefault;
  }
  renderDraftTableRows();
}

function rowHasWarning(row) {
  return Array.isArray(row.warnings) && row.warnings.length > 0;
}

function renderDraftTableRows() {
  const el = getElements();
  const payload = outcomeDraftState.payload;
  if (!el.draftTbody || !payload?.rows) return;
  const onlyWarn = outcomeDraftState.warningsOnly;
  el.draftTbody.innerHTML = (payload.rows || []).map((row) => {
    if (onlyWarn && !rowHasWarning(row)) return '';
    const warnShort = rowHasWarning(row)
      ? escapeHtml((row.warnings[0] && row.warnings[0].message) || 'Warning')
      : '—';
    const dup = row.duplicate?.suggestedAction || 'createNew';
    const canCheck = row.childItemIndex !== null && row.childItemIndex !== undefined;
    const checked = row.selected !== false ? ' checked' : '';
    const chk = canCheck
      ? '<input type="checkbox" class="report-outcome-draft-chk" data-draft-idx="' + row.childItemIndex + '"' + checked + ' />'
      : '';
    const exp = '<button type="button" class="link-style report-outcome-draft-expand" data-expand-draft="' + escapeHtml(row.id) + '">Details</button>';
    return '<tr data-draft-row-id="' + escapeHtml(row.id) + '" class="' + (rowHasWarning(row) ? 'has-warning' : '') + '">'
      + '<td>' + chk + '</td>'
      + '<td class="report-outcome-draft-title">' + escapeHtml(row.title) + '</td>'
      + '<td>' + escapeHtml(String(row.confidenceLabel || '')) + '</td>'
      + '<td class="report-outcome-draft-notes"><span class="dup-hint">' + escapeHtml(dup) + '</span><div class="warn-sub">' + warnShort + '</div></td>'
      + '<td>' + exp + '</td>'
      + '</tr>';
  }).filter(Boolean).join('');
}

async function runGenerateDraft(prefill = {}) {
  const { textarea, statusEl, generateDraftBtn, commitSelectedBtn } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const { projectPickerWrap, projectPicker } = getElements();
  const projectKey = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  if (!narrative || !projectKey) {
    updateUi(prefill);
    return;
  }
  const { boardId, quarterHint } = getDraftContextFromConfig();
  if (generateDraftBtn) {
    generateDraftBtn.disabled = true;
    generateDraftBtn.textContent = 'Drafting…';
  }
  setStatus(statusEl, '');
  try {
    const res = await fetch('/api/outcome-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        narrative,
        projectKey,
        selectedProjects: projects,
        boardId: Number.isFinite(boardId) ? boardId : null,
        inputMode: outcomeComposerState.inputMode,
        quarterHint,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(statusEl, json.message || json.error || 'Draft failed');
      return;
    }
    renderDraftPanel(json);
    setStatus(statusEl, 'Draft ready — review warnings, then create selected or create all.');
  } catch (err) {
    setStatus(statusEl, 'Draft request failed: ' + (err?.message || 'network'));
  } finally {
    if (generateDraftBtn) {
      generateDraftBtn.disabled = false;
      generateDraftBtn.textContent = 'Generate draft';
    }
    updateUi(prefill);
    if (outcomeDraftState.payload) {
      setStatus(statusEl, 'Draft ready — review warnings, then create selected or create all.');
    }
  }
}

async function submitDraftSelection(prefill = {}) {
  const payload = outcomeDraftState.payload;
  if (!payload?.rows?.length) return;
  const { textarea, statusEl, createBtn, commitSelectedBtn, projectPickerWrap, projectPicker, draftTbody, parentSummaryOverride } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const projectKey = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  const parsed = getParsedNarrative(narrative);
  const indices = [];
  if (draftTbody) {
    draftTbody.querySelectorAll('.report-outcome-draft-chk').forEach((box) => {
      if (box instanceof HTMLInputElement && box.checked) {
        const n = Number(box.getAttribute('data-draft-idx'));
        if (Number.isInteger(n) && n >= 0) indices.push(n);
      }
    });
  }
  const parentOverride = String(parentSummaryOverride?.value || '').trim();
  saveLastOutcomeProject(projectKey);
  if (commitSelectedBtn) {
    commitSelectedBtn.disabled = true;
    commitSelectedBtn.textContent = 'Creating…';
  }
  setButtonState(createBtn, true);
  setStatus(statusEl, '');
  try {
    const res = await fetch('/api/outcome-from-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        narrative,
        projectKey: projectKey || null,
        selectedProjects: projects,
        structureMode: parsed.structureMode,
        confidenceScore: parsed.confidenceScore,
        issueTypeName: outcomeComposerState.issueTypeName || null,
        childIssueTypeName: outcomeComposerState.childIssueTypeName || null,
        commitChildIndices: indices.length ? indices : undefined,
        parentSummaryOverride: parentOverride || undefined,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setStatus(statusEl, json.message || json.error || 'Create failed');
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (json?.summaryHtml) setStatus(statusEl, json.summaryHtml, true);
    else setStatus(statusEl, 'Created selected Jira work.', false);
    textarea.value = '';
    hideDraftPanel();
    resetComposerAfterSubmit();
  } catch (err) {
    setStatus(statusEl, 'Failed: ' + (err?.message || 'network'));
  } finally {
    if (commitSelectedBtn) {
      commitSelectedBtn.disabled = false;
      commitSelectedBtn.textContent = 'Create selected';
    }
    updateUi(prefill);
  }
}

function resetOutcomeComposerState() {
  outcomeComposerState.structureMode = 'AUTO';
  outcomeComposerState.parentIndex = 0;
  outcomeComposerState.issueTypeName = '';
  outcomeComposerState.childIssueTypeName = '';
  outcomeComposerState.showAdvanced = false;
  outcomeComposerState.inputMode = 'mixed';
}

function getEffectiveStructureMode() {
  if (outcomeComposerState.structureMode === 'AUTO') return '';
  if (outcomeComposerState.structureMode === 'SINGLE') return OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE;
  if (outcomeComposerState.structureMode === 'MULTIPLE') return OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS;
  if (outcomeComposerState.structureMode === 'PARENT_CHILD') {
    return outcomeComposerState.childIssueTypeName === 'Sub-task'
      ? OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS
      : OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES;
  }
  return '';
}

function getParsedNarrative(narrative) {
  return parseOutcomeIntake(narrative, {
    structureMode: getEffectiveStructureMode(),
    parentIndex: outcomeComposerState.parentIndex,
  });
}

function getTypeOptions(parsed) {
  if (!parsed?.hasMultipleItems) {
    return {
      issueTypes: ['Epic', 'Story', 'Task'],
      childTypes: [],
    };
  }
  return {
    issueTypes: ['Epic', 'Story', 'Feature', 'Task'],
    childTypes: ['Story', 'Sub-task', 'Task'],
  };
}

function renderOverrides(overridesEl, parsed) {
  if (!overridesEl) return;
  const lowConfidence = Number(parsed?.confidenceScore || 0) < 0.55;
  const show = parsed?.hasMultipleItems || lowConfidence || outcomeComposerState.showAdvanced;
  if (!show) {
    overridesEl.hidden = true;
    overridesEl.innerHTML = '';
    return;
  }
  const structureButtons = [
    { key: 'AUTO', label: 'Auto' },
    { key: 'SINGLE', label: 'Single' },
    { key: 'PARENT_CHILD', label: 'Parent + children' },
    { key: 'MULTIPLE', label: 'Multiple items' },
  ];
  const typeOptions = getTypeOptions(parsed);
  const inferredLabel = String(parsed?.inferredStructureMode || parsed?.structureMode || '').replace(/_/g, ' ').toLowerCase();
  const showTypeControls = outcomeComposerState.showAdvanced && (outcomeComposerState.structureMode !== 'AUTO' || lowConfidence);
  let html = '<div class="report-outcome-overrides-panel">';
  html += '<div class="report-outcome-overrides-head"><strong>Structure</strong><span>Auto picked ' + escapeHtml(inferredLabel || 'single issue') + '.</span><button type="button" class="link-style" data-outcome-toggle-advanced="' + (outcomeComposerState.showAdvanced ? 'collapse' : 'expand') + '">' + (outcomeComposerState.showAdvanced ? 'Hide options' : 'Adjust') + '</button></div>';
  if (outcomeComposerState.showAdvanced) {
    html += '<div class="report-outcome-structure-toggle report-outcome-structure-toggle-compact" role="group" aria-label="Choose work structure">';
    html += structureButtons.map((item) => {
      const active = outcomeComposerState.structureMode === item.key;
      const minimalLabel = item.key === 'AUTO' ? 'Auto' : item.label;
      return '<button type="button" class="btn btn-secondary btn-compact' + (active ? ' is-active' : '') + '" data-outcome-structure="' + escapeHtml(item.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(minimalLabel) + '</button>';
    }).join('');
    html += '</div>';
  } else {
    html += '<div class="report-outcome-structure-toggle report-outcome-structure-toggle-compact" role="group" aria-label="Detected work structure">';
    html += '<span class="report-outcome-structure-pill">' + escapeHtml(outcomeComposerState.structureMode === 'AUTO' ? 'Auto' : inferredLabel || 'auto') + '</span>';
    html += '</div>';
  }
  if (showTypeControls) {
    html += '<div class="report-outcome-type-row">';
    html += '<label class="insight-label" for="report-outcome-issue-type">Parent type</label>';
    html += '<select id="report-outcome-issue-type" class="insight-inline-input" aria-label="Choose parent issue type">';
    html += '<option value="">Auto</option>';
    html += typeOptions.issueTypes.map((value) => '<option value="' + escapeHtml(value) + '"' + (outcomeComposerState.issueTypeName === value ? ' selected' : '') + '>' + escapeHtml(value) + '</option>').join('');
    html += '</select>';
    if (typeOptions.childTypes.length > 0) {
      html += '<label class="insight-label" for="report-outcome-child-type">Child type</label>';
      html += '<select id="report-outcome-child-type" class="insight-inline-input" aria-label="Choose child issue type">';
      html += '<option value="">Auto</option>';
      html += typeOptions.childTypes.map((value) => '<option value="' + escapeHtml(value) + '"' + (outcomeComposerState.childIssueTypeName === value ? ' selected' : '') + '>' + escapeHtml(value) + '</option>').join('');
      html += '</select>';
    }
    html += '</div>';
  }
  html += '</div>';
  overridesEl.hidden = false;
  overridesEl.innerHTML = html;
}

function resetComposerAfterSubmit() {
  const { createBtn, overridesEl, parseSummaryEl } = getElements();
  resetOutcomeComposerState();
  hideDraftPanel();
  if (overridesEl) {
    overridesEl.hidden = true;
    overridesEl.innerHTML = '';
  }
  if (parseSummaryEl) {
    parseSummaryEl.hidden = true;
    parseSummaryEl.innerHTML = '';
  }
  setButtonState(createBtn, true, 'Create Jira work');
}

function updateProjectPicker(prefill = {}) {
  const { projectPickerWrap, projectPicker, projectPickerHint, projectsLineEl } = getElements();
  const projects = getAllowedProjects(prefill);
  projectsLineEl.textContent = projects.length
    ? 'Projects in context: ' + projects.join(', ')
    : 'Projects in context: none selected yet.';
  if (projects.length <= 1) {
    projectPickerWrap.hidden = true;
    projectPicker.innerHTML = '';
    projectPickerHint.textContent = '';
    return projects;
  }
  const preferred = String(prefill.preferredProject || readLastOutcomeProject() || projects[0] || '').trim().toUpperCase();
  projectPickerWrap.hidden = false;
  projectPicker.innerHTML = projects
    .map((project) => '<option value="' + escapeHtml(project) + '"' + (project === preferred ? ' selected' : '') + '>' + escapeHtml(project) + '</option>')
    .join('');
  projectPickerHint.textContent = 'Choose the primary project from the current context only.';
  return projects;
}

function renderParseSummary(parseSummaryEl, parsed, selectedProject) {
  if (!parseSummaryEl) return;
  if (!parsed || parsed.mode === 'empty') {
    parseSummaryEl.hidden = true;
    parseSummaryEl.innerHTML = '';
    return;
  }
  const previewItems = [];
  (parsed.previewRows || []).forEach((item, index) => {
    const markerMap = { EPIC: 'E', STORY: 'S', SUBTASK: 'T', ISSUE: 'I' };
    const marker = item.jiraKeys?.length ? 'L' : (markerMap[item.kind] || 'I');
    const suffix = item.jiraKeys?.length
      ? ' <span class="outcome-preview-note">Existing issue ' + escapeHtml(item.jiraKeys[0]) + ' - will be linked, not created.</span>'
      : '';
    const canMakeParent = parsed.hasMultipleItems
      && parsed.structureMode !== OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE
      && parsed.structureMode !== OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS
      && parsed.structureMode !== OUTCOME_STRUCTURE_MODE.TABLE_ISSUES
      && index > 0;
    const parentBadge = parsed.hasMultipleItems && index === 0 && !canMakeParent
      ? ' <span class="outcome-preview-note">Parent</span>'
      : '';
    const parentAction = canMakeParent
      ? ' <button type="button" class="link-style" data-outcome-make-parent="' + index + '">Make parent</button>'
      : '';
    previewItems.push('<li><span class="outcome-preview-kind">' + marker + '</span><span class="outcome-preview-text">' + escapeHtml(item.title) + '</span>' + parentBadge + suffix + parentAction + '</li>');
  });
  const createCount = (parsed.previewRows || []).filter((item) => !(item.jiraKeys?.length)).length;
  let summary = 'Will create 1 Jira issue from the full narrative.';
  if (parsed.structureMode === 'EPIC_WITH_STORIES') {
    summary = 'Will create ' + Math.max(0, createCount - 1) + ' backlog items under 1 parent issue in project ' + escapeHtml(selectedProject || 'current project') + '.';
  } else if (parsed.structureMode === 'STORY_WITH_SUBTASKS') {
    summary = 'Will create 1 parent issue plus ' + Math.max(0, createCount - 1) + ' child items in project ' + escapeHtml(selectedProject || 'current project') + '.';
  } else if (parsed.structureMode === 'MULTIPLE_EPICS') {
    summary = 'Will create ' + createCount + ' top-level Jira items in project ' + escapeHtml(selectedProject || 'current project') + '.';
  } else if (parsed.structureMode === 'TABLE_ISSUES') {
    summary = 'Detected table input - will create ' + createCount + ' issues with descriptions in project ' + escapeHtml(selectedProject || 'current project') + '.';
  } else if (parsed.structureMode === 'SINGLE_ISSUE') {
    summary = parsed.rationale || summary;
  }
  parseSummaryEl.hidden = false;
  parseSummaryEl.innerHTML = ''
    + '<div class="report-outcome-parse-head">' + summary + '</div>'
    + '<div class="report-outcome-parse-mode">Mode: ' + escapeHtml(parsed.structureMode.replace(/_/g, ' ').toLowerCase()) + ' (' + escapeHtml(parsed.confidenceLabel) + ')</div>'
    + '<ol class="report-outcome-preview-list">' + previewItems.join('') + '</ol>';
}

function updateUi(prefill = {}) {
  const {
    textarea, statusEl, createBtn, generateDraftBtn, commitSelectedBtn, draftPanel,
    projectPickerWrap, projectPicker, overridesEl, parseSummaryEl,
  } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const selectedProject = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  const parsed = getParsedNarrative(narrative);
  const jiraKey = parsed.structureMode === 'SINGLE_ISSUE' ? findFirstJiraKey(narrative) : '';
  const skipStatus = () => !!(outcomeDraftState.payload && draftPanel && !draftPanel.hidden);

  syncInputModeRadios();

  if (!narrative) {
    hideDraftPanel();
    setStatus(statusEl, '');
    setButtonState(createBtn, true);
    if (generateDraftBtn) {
      generateDraftBtn.disabled = true;
      generateDraftBtn.textContent = 'Generate draft';
    }
    return;
  }

  renderOverrides(overridesEl, parsed);
  renderParseSummary(parseSummaryEl, parsed, selectedProject);

  const disableBoth = () => {
    setButtonState(createBtn, true);
    if (generateDraftBtn) {
      generateDraftBtn.disabled = true;
      generateDraftBtn.textContent = 'Generate draft';
    }
    if (commitSelectedBtn) {
      commitSelectedBtn.disabled = true;
    }
  };

  if (jiraKey) {
    if (!skipStatus()) setStatus(statusEl, 'This already has a Jira issue: ' + jiraKey + ' - use it.');
    disableBoth();
    return;
  }
  if (projects.length > 1 && !selectedProject) {
    if (!skipStatus()) setStatus(statusEl, 'Choose a primary project from the current context.');
    disableBoth();
    return;
  }
  if (selectedProject && projects.length && !projects.includes(selectedProject)) {
    if (!skipStatus()) setStatus(statusEl, 'Project key not in active context. Choose one of: ' + projects.join(', '));
    disableBoth();
    return;
  }
  if (parsed.structureMode !== 'EMPTY') {
    const existingLinks = (parsed.previewRows || []).filter((item) => Array.isArray(item.jiraKeys) && item.jiraKeys.length > 0);
    const creatable = (parsed.previewRows || []).filter((item) => !(item.jiraKeys?.length));
    const buttonLabelMap = {
      EPIC_WITH_STORIES: 'Create ' + creatable.length + ' Jira issues from this list',
      STORY_WITH_SUBTASKS: 'Create parent + child items',
      MULTIPLE_EPICS: 'Create ' + creatable.length + ' Jira items',
      TABLE_ISSUES: 'Create ' + creatable.length + ' Jira issues',
      SINGLE_ISSUE: 'Create 1 Jira issue',
    };
    const statusBits = [parsed.rationale];
    if (existingLinks.length) statusBits.push(existingLinks.length + ' existing Jira issue' + (existingLinks.length === 1 ? '' : 's') + ' will link instead of duplicate.');
    if (!skipStatus()) setStatus(statusEl, statusBits.join(' '));
    setButtonState(createBtn, false, buttonLabelMap[parsed.structureMode] || 'Create Jira issue');
    if (generateDraftBtn) {
      generateDraftBtn.disabled = false;
      generateDraftBtn.textContent = 'Generate draft';
    }
    return;
  }
  if (!skipStatus()) setStatus(statusEl, 'No Jira key detected. Create Jira issue from this narrative.');
  setButtonState(createBtn, false, 'Create Jira issue');
  if (generateDraftBtn) {
    generateDraftBtn.disabled = false;
    generateDraftBtn.textContent = 'Generate draft';
  }
}

async function submit(prefill = {}) {
  const { textarea, statusEl, createBtn, projectPickerWrap, projectPicker } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const projectKey = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  const parsed = getParsedNarrative(narrative);
  if (!narrative) {
    updateUi(prefill);
    return;
  }

  saveLastOutcomeProject(projectKey);
  setButtonState(createBtn, true, 'Creating...');
  setStatus(statusEl, '');

  const createRequest = async (createAnyway = false) => fetch('/api/outcome-from-narrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narrative,
      projectKey: projectKey || null,
      selectedProjects: projects,
      structureMode: parsed.structureMode,
      confidenceScore: parsed.confidenceScore,
      issueTypeName: outcomeComposerState.issueTypeName || null,
      childIssueTypeName: outcomeComposerState.childIssueTypeName || null,
      createAnyway: !!createAnyway,
    }),
  });

  try {
    const res = await createRequest(false);
    if (res.status === 409) {
      let conflict = null;
      try { conflict = await res.json(); } catch (_) {}
      if (conflict?.code === 'NARRATIVE_HAS_EXISTING_KEY') {
        setStatus(statusEl, conflict.message || 'This narrative already references a Jira issue. Use it.');
        setButtonState(createBtn, true);
        return;
      }
      if (conflict?.code === 'POSSIBLE_DUPLICATE_OUTCOME' && conflict?.duplicate?.key) {
        const duplicate = conflict.duplicate;
        const duplicateLink = duplicate.url
          ? '<a href="' + escapeHtml(duplicate.url) + '" target="_blank" rel="noopener">' + escapeHtml(duplicate.key) + '</a>'
          : escapeHtml(duplicate.key);
        setStatus(
          statusEl,
          'Looks like ' + duplicateLink + ' already exists - <button type="button" class="link-style" data-outcome-action="use-existing">Use existing</button> / <button type="button" class="link-style" data-outcome-action="create-anyway">Create anyway</button>',
          true,
        );
        statusEl.querySelector('[data-outcome-action="use-existing"]')?.addEventListener('click', () => {
          setStatus(statusEl, 'Using existing Jira issue ' + duplicate.key + '.');
          setButtonState(createBtn, false);
        }, { once: true });
        statusEl.querySelector('[data-outcome-action="create-anyway"]')?.addEventListener('click', async () => {
          setButtonState(createBtn, true, 'Creating...');
          try {
            const forced = await createRequest(true);
            const json = await forced.json().catch(() => ({}));
            const key = json?.key || json?.issueKey || '';
            const url = json?.url || json?.issueUrl || '';
            if (json?.summaryHtml) setStatus(statusEl, json.summaryHtml, true);
            else if (key && url) setStatus(statusEl, 'Created Jira issue <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(key) + '</a>.', true);
            else setStatus(statusEl, key ? 'Created Jira issue ' + key + '.' : 'Created Jira issue from narrative.');
            textarea.value = '';
            resetComposerAfterSubmit();
          } catch (error) {
            setStatus(statusEl, 'Failed to create Jira issue: ' + (error?.message || 'Network error'));
            updateUi(prefill);
          } finally {
            if (textarea.value) setButtonState(createBtn, false);
          }
        }, { once: true });
        setButtonState(createBtn, false);
        return;
      }
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const problems = Array.isArray(json?.details?.problems) ? json.details.problems : [];
      const detailText = problems.length
        ? ' ' + problems.map((problem) => {
          const role = String(problem?.role || 'issue').trim();
          const issueTypeName = String(problem?.issueTypeName || 'issue').trim();
          const missingFields = Array.isArray(problem?.missingFields) ? problem.missingFields.filter(Boolean) : [];
          return role + ' ' + issueTypeName + (missingFields.length ? ' needs ' + missingFields.join(', ') : '');
        }).join(' | ')
        : '';
      setStatus(statusEl, (json?.message || 'Could not create Jira issue from this narrative.') + detailText);
      setButtonState(createBtn, false);
      return;
    }
    const json = await res.json().catch(() => ({}));
    const key = json?.key || json?.issueKey || '';
    const url = json?.url || json?.issueUrl || '';
    if (json?.summaryHtml) setStatus(statusEl, json.summaryHtml, true);
    else if (key && url) setStatus(statusEl, 'Created Jira issue <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(key) + '</a>.', true);
    else setStatus(statusEl, key ? 'Created Jira issue ' + key + '.' : 'Created Jira issue from narrative.');
    textarea.value = '';
    resetComposerAfterSubmit();
  } catch (error) {
    setStatus(statusEl, 'Failed to create Jira issue: ' + (error?.message || 'Network error'));
    setButtonState(createBtn, false);
    updateUi(prefill);
  }
}

export function openGlobalOutcomeModal(prefill = {}) {
  const elements = getElements();
  resetOutcomeComposerState();
  hideDraftPanel();
  elements.modal.__outcomePrefill = prefill;
  updateProjectPicker(prefill);
  elements.contextEl.textContent = prefill.contextLabel || 'Promote a narrative, risk, or board signal into trackable Jira work.';
  elements.textarea.value = String(prefill.narrative || '').trim();
  setStatus(elements.statusEl, '');
  updateUi(prefill);
  if (!modalController) {
    modalController = createModalBehavior('#global-outcome-modal', {
      onOpen: () => { elements.modal.style.display = 'flex'; },
      onClose: () => { elements.modal.style.display = 'none'; },
    });
  }
  modalController.open();
  elements.textarea.focus();
}

export function initGlobalOutcomeModal(config = {}) {
  currentConfig = config || {};
  const elements = getElements();
  if (elements.modal.dataset.outcomeModalBound === '1') return;
  elements.modal.dataset.outcomeModalBound = '1';

  elements.textarea.addEventListener('input', () => updateUi(elements.modal.__outcomePrefill || {}));
  elements.textarea.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      const g = elements.generateDraftBtn;
      if (g && !g.disabled) {
        ev.preventDefault();
        runGenerateDraft(elements.modal.__outcomePrefill || {});
      }
    }
  });
  elements.projectPicker.addEventListener('change', () => updateUi(elements.modal.__outcomePrefill || {}));
  elements.createBtn.addEventListener('click', () => submit(elements.modal.__outcomePrefill || {}));
  elements.generateDraftBtn?.addEventListener('click', () => runGenerateDraft(elements.modal.__outcomePrefill || {}));
  elements.commitSelectedBtn?.addEventListener('click', () => submitDraftSelection(elements.modal.__outcomePrefill || {}));
  elements.modal.querySelector('#report-outcome-accept-safe')?.addEventListener('click', () => {
    if (!outcomeDraftState.payload?.rows) return;
    outcomeDraftState.payload.rows.forEach((row) => {
      row.selected = !rowHasWarning(row);
    });
    outcomeDraftState.warningsOnly = false;
    renderDraftTableRows();
    elements.modal.querySelectorAll('#report-outcome-draft-tbody .report-outcome-draft-chk').forEach((box) => {
      if (box instanceof HTMLInputElement) {
        const idx = Number(box.getAttribute('data-draft-idx'));
        const row = outcomeDraftState.payload.rows.find((r) => r.childItemIndex === idx);
        if (row) box.checked = !!row.selected;
      }
    });
  });
  elements.modal.querySelector('#report-outcome-review-warnings')?.addEventListener('click', () => {
    outcomeDraftState.warningsOnly = true;
    renderDraftTableRows();
  });
  elements.modal.querySelector('#report-outcome-cancel-draft')?.addEventListener('click', () => {
    hideDraftPanel();
    updateUi(elements.modal.__outcomePrefill || {});
  });
  elements.modal.addEventListener('click', (event) => {
    const exp = event.target?.closest?.('[data-expand-draft]');
    if (exp) {
      const id = exp.getAttribute('data-expand-draft');
      const tr = exp.closest('tr');
      const next = tr?.nextElementSibling;
      if (next && next.classList.contains('report-outcome-draft-detail-tr')) {
        next.remove();
        return;
      }
      const row = outcomeDraftState.payload?.rows?.find((r) => r.id === id);
      if (!tr || !row) return;
      const detail = document.createElement('tr');
      detail.className = 'report-outcome-draft-detail-tr';
      const full = (row.warnings || []).map((w) => escapeHtml(w.message || '')).join('<br/>') || 'No extra detail.';
      detail.innerHTML = '<td colspan="5" class="report-outcome-draft-detail-cell">' + full + '</td>';
      tr.insertAdjacentElement('afterend', detail);
      return;
    }
    const structureBtn = event.target?.closest?.('[data-outcome-structure]');
    if (structureBtn) {
      outcomeComposerState.structureMode = structureBtn.getAttribute('data-outcome-structure') || 'AUTO';
      outcomeComposerState.showAdvanced = true;
      if (outcomeComposerState.structureMode === 'SINGLE') outcomeComposerState.parentIndex = 0;
      updateUi(elements.modal.__outcomePrefill || {});
      return;
    }
    const advancedBtn = event.target?.closest?.('[data-outcome-toggle-advanced]');
    if (advancedBtn) {
      outcomeComposerState.showAdvanced = advancedBtn.getAttribute('data-outcome-toggle-advanced') === 'expand';
      updateUi(elements.modal.__outcomePrefill || {});
      return;
    }
    const makeParentBtn = event.target?.closest?.('[data-outcome-make-parent]');
    if (makeParentBtn) {
      outcomeComposerState.structureMode = 'PARENT_CHILD';
      outcomeComposerState.showAdvanced = true;
      outcomeComposerState.parentIndex = Number(makeParentBtn.getAttribute('data-outcome-make-parent') || 0);
      updateUi(elements.modal.__outcomePrefill || {});
    }
  });
  elements.modal.addEventListener('change', (event) => {
    const t0 = event.target;
    if (t0 instanceof HTMLInputElement && t0.name === 'report-outcome-input-mode') {
      outcomeComposerState.inputMode = t0.value || 'mixed';
      return;
    }
    if (t0 instanceof HTMLInputElement && t0.classList.contains('report-outcome-draft-chk')) {
      const idx = Number(t0.getAttribute('data-draft-idx'));
      const row = outcomeDraftState.payload?.rows?.find((r) => r.childItemIndex === idx);
      if (row) row.selected = t0.checked;
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id === 'report-outcome-issue-type') {
      outcomeComposerState.issueTypeName = String(target.value || '').trim();
      updateUi(elements.modal.__outcomePrefill || {});
      return;
    }
    if (target.id === 'report-outcome-child-type') {
      outcomeComposerState.childIssueTypeName = String(target.value || '').trim();
      outcomeComposerState.showAdvanced = true;
      if (outcomeComposerState.childIssueTypeName) outcomeComposerState.structureMode = 'PARENT_CHILD';
      updateUi(elements.modal.__outcomePrefill || {});
    }
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.('[data-open-outcome-modal]');
    if (!trigger) return;
    event.preventDefault();
    openGlobalOutcomeModal({
      narrative: trigger.getAttribute('data-outcome-prefill') || '',
      preferredProject: trigger.getAttribute('data-outcome-project') || '',
      contextLabel: trigger.getAttribute('data-outcome-context') || '',
      contextProjects: (trigger.getAttribute('data-outcome-projects') || '').split(',').map((value) => value.trim()).filter(Boolean),
    });
  });

  window.addEventListener('app:openOutcomeModal', (event) => {
    openGlobalOutcomeModal(event?.detail || {});
  });
}
