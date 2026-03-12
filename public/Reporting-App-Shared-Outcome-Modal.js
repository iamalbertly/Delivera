import { createModalBehavior } from './Reporting-App-Core-UI-02Primitives-Modal.js';
import { isJiraIssueKey } from './Reporting-App-Report-Utils-Jira-Helpers.js';

let modalController = null;
let currentConfig = {};

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
    + '<h3 id="global-outcome-modal-title">Create Jira Epic from this narrative</h3>'
    + '<p id="global-outcome-modal-context" class="report-outcome-intake-hint">Promote a narrative, risk, or board signal into a trackable Jira epic.</p>'
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
    + '<div class="report-outcome-intake-actions">'
    + '<span id="report-outcome-intake-status" class="report-outcome-intake-status" aria-live="polite"></span>'
    + '<button type="button" id="report-outcome-intake-create" class="btn btn-compact report-outcome-intake-create-btn" disabled>Create Jira Epic from this narrative</button>'
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
  button.textContent = label || 'Create Jira Epic from this narrative';
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
  const preferred = String(prefill.preferredProject || projects[0] || '').trim().toUpperCase();
  projectPickerWrap.hidden = false;
  projectPicker.innerHTML = projects
    .map((project) => '<option value="' + escapeHtml(project) + '"' + (project === preferred ? ' selected' : '') + '>' + escapeHtml(project) + '</option>')
    .join('');
  projectPickerHint.textContent = 'Choose the primary project from the current context only.';
  return projects;
}

function updateUi(prefill = {}) {
  const { textarea, statusEl, createBtn, projectPickerWrap, projectPicker } = getElements();
  const narrative = String(textarea.value || '').trim();
  const jiraKey = findFirstJiraKey(narrative);
  const projects = getAllowedProjects(prefill);
  const selectedProject = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();

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
  setStatus(statusEl, 'No Jira key detected. Create Jira Epic from this narrative.');
  setButtonState(createBtn, false);
}

async function submit(prefill = {}) {
  const { textarea, statusEl, createBtn, projectPickerWrap, projectPicker } = getElements();
  const narrative = String(textarea.value || '').trim();
  const projects = getAllowedProjects(prefill);
  const projectKey = projectPickerWrap.hidden ? (projects[0] || '') : String(projectPicker.value || '').trim().toUpperCase();
  if (!narrative) {
    updateUi(prefill);
    return;
  }

  setButtonState(createBtn, true, 'Creating...');
  setStatus(statusEl, '');

  const createRequest = async (createAnyway = false) => fetch('/api/outcome-from-narrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narrative,
      projectKey: projectKey || null,
      selectedProjects: projects,
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
            if (key && url) setStatus(statusEl, 'Created Jira epic <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(key) + '</a>.', true);
            else setStatus(statusEl, key ? 'Created Jira epic ' + key + '.' : 'Created Jira epic from narrative.');
            textarea.value = '';
          } catch (error) {
            setStatus(statusEl, 'Failed to create Jira epic: ' + (error?.message || 'Network error'));
          } finally {
            setButtonState(createBtn, false);
            updateUi(prefill);
          }
        }, { once: true });
        setButtonState(createBtn, false);
        return;
      }
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setStatus(statusEl, json?.message || 'Could not create Jira epic from this narrative.');
      setButtonState(createBtn, false);
      return;
    }
    const json = await res.json().catch(() => ({}));
    const key = json?.key || json?.issueKey || '';
    const url = json?.url || json?.issueUrl || '';
    if (key && url) setStatus(statusEl, 'Created Jira epic <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(key) + '</a>. Update details in Jira if needed.', true);
    else setStatus(statusEl, key ? 'Created Jira epic ' + key + '. Update details in Jira if needed.' : 'Created Jira epic from narrative.');
    textarea.value = '';
    setButtonState(createBtn, false);
  } catch (error) {
    setStatus(statusEl, 'Failed to create Jira epic: ' + (error?.message || 'Network error'));
    setButtonState(createBtn, false);
  }
  updateUi(prefill);
}

export function openGlobalOutcomeModal(prefill = {}) {
  const elements = getElements();
  elements.modal.__outcomePrefill = prefill;
  updateProjectPicker(prefill);
  elements.contextEl.textContent = prefill.contextLabel || 'Promote a narrative, risk, or board signal into a trackable Jira epic.';
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
