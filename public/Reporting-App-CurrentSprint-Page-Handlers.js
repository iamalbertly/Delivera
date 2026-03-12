
import { loadCurrentSprint } from './Reporting-App-CurrentSprint-Page-Data-Loaders.js';
import { showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage } from './Reporting-App-CurrentSprint-Render-Page.js';

let isGlobalHoverBound = false;
let isCardToggleBound = false;
let isIssueJumpBound = false;

function bindGlobalPrefetchHover() {
  if (isGlobalHoverBound) return;
  isGlobalHoverBound = true;
  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest('[data-sprint-id], [data-action="drill-down"]');
    if (!trigger || trigger.dataset.prefetched) return;
    trigger.dataset.prefetched = 'true';
    const sprintId = trigger.dataset.sprintId;
    if (sprintId) {
      console.log(`[Growth] Optimistic prefetch for sprint ${sprintId}`);
      // In next phase: fetch(`/api/sprint-details/${sprintId}`).catch(()=>{});
    }
  }, { passive: true });
}

function bindCardToggles() {
  if (isCardToggleBound) return;
  isCardToggleBound = true;
  document.querySelectorAll('.card-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const card = targetId ? document.getElementById(targetId) : null;
      if (card) {
        card.classList.toggle('is-collapsed');
        btn.textContent = card.classList.contains('is-collapsed') ? 'Expand' : 'Minimize';
      }
    });
  });
}

function parseJiraIssueKey(input) {
  const text = String(input || '').trim();
  if (!text) return '';
  const browseMatch = text.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
  if (browseMatch && browseMatch[1]) return String(browseMatch[1]).toUpperCase();
  const keyMatch = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
  return keyMatch && keyMatch[1] ? String(keyMatch[1]).toUpperCase() : '';
}

function bindIssueJump() {
  if (isIssueJumpBound) return;
  isIssueJumpBound = true;
  const input = document.getElementById('issue-jump-input');
  const status = document.getElementById('current-sprint-single-project-hint');
  if (!input) return;

  const focusRow = (row) => {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('row-attention-pulse');
    window.setTimeout(() => row.classList.remove('row-attention-pulse'), 1400);
  };

  const runJump = () => {
    const key = parseJiraIssueKey(input.value);
    if (!key) {
      if (status) status.textContent = 'Paste a Jira /browse/KEY link or a KEY to jump.';
      return;
    }
    const row = document.querySelector('.story-parent-row[data-parent-key="' + key + '"]')
      || document.querySelector('.work-risk-parent-row[data-parent-key="' + key + '"]')
      || Array.from(document.querySelectorAll('#stories-table tbody tr, #work-risks-table tbody tr'))
        .find((tr) => String(tr.textContent || '').toUpperCase().includes(key));
    if (row) {
      focusRow(row);
      if (status) status.textContent = 'Jumped to ' + key + '.';
      return;
    }
    if (status) status.textContent = 'Issue ' + key + ' not found in this sprint view. Verify board or sprint.';
  };

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runJump();
  });
}

export function wireDynamicHandlers(data) {
  bindGlobalPrefetchHover();
  bindCardToggles();
  bindIssueJump();

  const saveBtn = document.getElementById('notes-save');
  // Clean event listener replacement
  if (saveBtn && data?.sprint) {
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.addEventListener('click', () => saveNotes(data.board?.id, data.sprint?.id));
  }

  // Purged legacy notification logic (Removed ~80 lines of dead code)
}

function saveNotes(boardId, sprintId) {
  const depsEl = document.getElementById('notes-dependencies');
  const learningsEl = document.getElementById('notes-learnings');
  const statusEl = document.getElementById('notes-status');
  const saveBtn = document.getElementById('notes-save');
  if (!depsEl || !learningsEl || !statusEl) return;
  if (!boardId || !sprintId) return;

  statusEl.textContent = 'Saving...';
  if (saveBtn) saveBtn.disabled = true;

  fetch('/api/current-sprint-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardId, sprintId, dependencies: depsEl.value, learnings: learningsEl.value }),
  })
    .then(r => r.ok ? r.json() : Promise.reject('Failed'))
    .then(() => {
      statusEl.textContent = 'Saved.';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
      return loadCurrentSprint(boardId, sprintId);
    })
    .then(d => { if (d) showContent(renderCurrentSprintPage(d)); })
    .catch(() => { statusEl.textContent = 'Save failed.'; })
    .finally(() => { if (saveBtn) saveBtn.disabled = false; });
}
