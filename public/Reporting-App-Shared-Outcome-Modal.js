import { createModalBehavior } from './Reporting-App-Core-UI-02Primitives-Modal.js';
import { isJiraIssueKey } from './Reporting-App-Report-Utils-Jira-Helpers.js';
import { OUTCOME_STRUCTURE_MODE, parseOutcomeIntake } from './Reporting-App-Shared-Outcome-Intake-Parser.js';

let modalController = null;
let currentConfig = {};
const LAST_OUTCOME_PROJECT_KEY = 'report_last_outcome_project_v1';
const outcomeComposerState = {
  structureMode: 'AUTO',
  parentIndex: 0,
  issueTypeName: '',
  childIssueTypeName: '',
  showAdvanced: false,
};

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
    + '<div id="report-outcome-overrides" class="report-outcome-overrides" hidden></div>'
    + '<div id="report-outcome-parse-summary" class="report-outcome-parse-summary" hidden></div>'
    + '<div class="report-outcome-intake-actions">'
    + '<span id="report-outcome-intake-status" class="report-outcome-intake-status" aria-live="polite"></span>'
    + '<button type="button" id="report-outcome-intake-create" class="btn btn-compact report-outcome-intake-create-btn" disabled>Create Jira work from this narrative</button>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
  return modal;
}

function getElements() {
  const modal = ensureOutcomeModal();
  return {
    modal,
    textarea: modal.querySelector('#report-outcome-text'),
    statusEl: modal.querySelector('#report-outcome-intake-status'),
    createBtn: modal.querySelector('#report-outcome-intake-create'),
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
  button.textContent = label || 'Create Jira work from this narrative';
}

function resetOutcomeComposerState() {
  outcomeComposerState.structureMode = 'AUTO';
  outcomeComposerState.parentIndex = 0;
  outcomeComposerState.issueTypeName = '';
  outcomeComposerState.childIssueTypeName = '';
  outcomeComposerState.showAdvanced = false;
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
  html += '<div class="report-outcome-structure-toggle report-outcome-structure-toggle-compact" role="group" aria-label="Choose work structure">';
  html += structureButtons.map((item) => {
    const active = outcomeComposerState.structureMode === item.key;
    const minimalLabel = item.key === 'AUTO' ? 'Auto' : item.label;
    return '<button type="button" class="btn btn-secondary btn-compact' + (active ? ' is-active' : '') + '" data-outcome-structure="' + escapeHtml(item.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(minimalLabel) + '</button>';
  }).join('');
  html += '</div>';
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
  if (overridesEl) {
    overridesEl.hidden = true;
    overridesEl.innerHTML = '';
  }
  if (parseSummaryEl) {
    parseSummaryEl.hidden = true;
    parseSummaryEl.innerHTML = '';
  }
  setButtonState(createBtn, true, 'Create Jira work from this narrative');
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
  const { textarea, statusEl, createBtn, projectPickerWrap, projectPicker, overridesEl, parseSummaryEl } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const selectedProject = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  const parsed = getParsedNarrative(narrative);
  const jiraKey = parsed.structureMode === 'SINGLE_ISSUE' ? findFirstJiraKey(narrative) : '';

  renderOverrides(overridesEl, parsed);
  renderParseSummary(parseSummaryEl, parsed, selectedProject);

  if (!narrative) {
    setStatus(statusEl, '');
    setButtonState(createBtn, true);
    return;
  }
  if (jiraKey) {
    setStatus(statusEl, 'This already has a Jira issue: ' + jiraKey + ' - use it.');
    setButtonState(createBtn, true);
    return;
  }
  if (projects.length > 1 && !selectedProject) {
    setStatus(statusEl, 'Choose a primary project from the current context.');
    setButtonState(createBtn, true);
    return;
  }
  if (selectedProject && projects.length && !projects.includes(selectedProject)) {
    setStatus(statusEl, 'Project key not in active context. Choose one of: ' + projects.join(', '));
    setButtonState(createBtn, true);
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
    setStatus(statusEl, statusBits.join(' '));
    setButtonState(createBtn, false, buttonLabelMap[parsed.structureMode] || 'Create Jira issue');
    return;
  }
  setStatus(statusEl, 'No Jira key detected. Create Jira issue from this narrative.');
  setButtonState(createBtn, false, 'Create Jira issue');
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
  elements.projectPicker.addEventListener('change', () => updateUi(elements.modal.__outcomePrefill || {}));
  elements.createBtn.addEventListener('click', () => submit(elements.modal.__outcomePrefill || {}));
  elements.modal.addEventListener('click', (event) => {
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
