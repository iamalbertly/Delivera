import { loadCurrentSprint } from './Delivera-CurrentSprint-Page-Data-Loaders.js';

let isGlobalHoverBound = false;
let isCardToggleBound = false;
let isIssueJumpBound = false;
let notesSaveTimer = null;

function bindGlobalPrefetchHover() {
  if (isGlobalHoverBound) return;
  isGlobalHoverBound = true;
  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest('[data-sprint-id], [data-action="drill-down"]');
    if (trigger && !trigger.dataset.prefetched) {
      trigger.dataset.prefetched = 'true';
      const sprintId = trigger.dataset.sprintId;
      if (sprintId) {
        // In next phase: fetch(`/api/sprint-details/${sprintId}`).catch(()=>{});
      }
    }
    // Hover-read: expand parent story children without requiring a toggle click.
    const parent = e.target.closest('tr.story-parent-row[data-has-children="true"]');
    if (parent && parent.getAttribute('aria-expanded') !== 'true' && !parent.dataset.hoverExpandLocked) {
      parent.setAttribute('aria-expanded', 'true');
      parent.classList.add('story-parent-row-expanded');
      parent.dataset.hoverPeek = '1';
      const key = parent.getAttribute('data-parent-key');
      const toggle = parent.querySelector('.story-row-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      if (key) {
        document.querySelectorAll(`tr.subtask-child-row[data-parent-key="${key}"]`).forEach((child) => {
          child.hidden = false;
          child.style.display = '';
        });
      }
    }
  }, { passive: true });
  document.addEventListener('mouseout', (e) => {
    const parent = e.target.closest?.('tr.story-parent-row[data-hover-peek="1"]');
    if (!parent) return;
    const related = e.relatedTarget;
    if (related && parent.contains(related)) return;
    if (parent.dataset.hoverExpandLocked === '1') return;
    // Keep click-expanded rows open; only collapse pure hover peeks.
    if (parent.querySelector('.story-row-toggle')?.getAttribute('aria-expanded') === 'true'
      && parent.dataset.userExpanded === '1') return;
    parent.setAttribute('aria-expanded', 'false');
    parent.classList.remove('story-parent-row-expanded');
    delete parent.dataset.hoverPeek;
    const key = parent.getAttribute('data-parent-key');
    const toggle = parent.querySelector('.story-row-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (key) {
      document.querySelectorAll(`tr.subtask-child-row[data-parent-key="${key}"]`).forEach((child) => {
        child.hidden = true;
        child.style.display = 'none';
      });
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

  const getCandidateRows = () =>
    Array.from(document.querySelectorAll('#stories-table tbody tr.story-parent-row, #stories-mobile-card-list .story-mobile-card'))
      .filter((row) => !row.classList.contains('subtask-child-row'));

  const applyJumpFilter = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    const rows = getCandidateRows();
    let firstMatch = null;
    rows.forEach((row) => {
      const haystack = String(row.textContent || '').toLowerCase();
      const show = !normalized || haystack.includes(normalized);
      row.style.display = show ? '' : 'none';
      if (show && !firstMatch) firstMatch = row;
    });
    const visibleCount = rows.filter((row) => row.style.display !== 'none').length;
    const url = new URL(window.location.href);
    if (normalized) url.searchParams.set('q', normalized); else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
    if (normalized && firstMatch) {
      focusRow(firstMatch);
      if (status) status.textContent = `${visibleCount} matching work item${visibleCount === 1 ? '' : 's'}.`;
    } else if (normalized && status) {
      status.textContent = 'No matching work item in this sprint.';
    } else if (status) {
      status.textContent = 'Using single-project mode';
    }
  };

  const runJump = () => {
    const key = parseJiraIssueKey(input.value);
    if (!key) {
      const query = String(input.value || '').trim().toLowerCase();
      if (!query) {
        applyJumpFilter('');
        return;
      }
      applyJumpFilter(query);
      return;
    }
    const row = document.querySelector('.story-parent-row[data-parent-key="' + key + '"]')
      || document.querySelector('.story-mobile-card[data-parent-key="' + key + '"]')
      || Array.from(document.querySelectorAll('#stories-table tbody tr.story-parent-row, #stories-mobile-card-list .story-mobile-card'))
        .find((tr) => String(tr.textContent || '').toUpperCase().includes(key));
    if (row) {
      applyJumpFilter(key);
      focusRow(row);
      if (status) status.textContent = 'Jumped to ' + key + '.';
      return;
    }
    if (status) status.textContent = key + ' is not in this sprint view.';
  };

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runJump();
  });
  input.addEventListener('input', () => {
    applyJumpFilter(input.value);
  });
}

export function wireDynamicHandlers(data) {
  bindGlobalPrefetchHover();
  bindCardToggles();
  bindIssueJump();
  bindNotesAutosave(data);

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
      statusEl.textContent = 'Saved just now';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    })
    .catch(() => { statusEl.textContent = 'Save failed.'; })
    .finally(() => { if (saveBtn) saveBtn.disabled = false; });
}

function bindNotesAutosave(data) {
  const depsEl = document.getElementById('notes-dependencies');
  const learningsEl = document.getElementById('notes-learnings');
  if (!depsEl || !learningsEl || !data?.board?.id || !data?.sprint?.id) return;
  const queueSave = () => {
    if (notesSaveTimer) window.clearTimeout(notesSaveTimer);
    notesSaveTimer = window.setTimeout(() => {
      saveNotes(data.board?.id, data.sprint?.id);
    }, 2000);
  };
  [depsEl, learningsEl].forEach((el) => {
    if (el.dataset.notesAutosaveWired === '1') return;
    el.dataset.notesAutosaveWired = '1';
    el.addEventListener('input', queueSave);
    el.addEventListener('blur', queueSave);
  });
}
