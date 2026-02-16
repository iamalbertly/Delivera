
import { buildNotificationMessage } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { getErrorMessage, loadCurrentSprint } from './Reporting-App-CurrentSprint-Page-Data-Loaders.js';
import { showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage } from './Reporting-App-CurrentSprint-Render-Page.js';

let isGlobalHoverBound = false;
let isGlobalClickBound = false;
let isCardToggleBound = false;

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

function bindGlobalClickHandlers() {
  if (isGlobalClickBound) return;
  isGlobalClickBound = true;
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.card-details-toggle');
    if (toggle) {
      const wrap = toggle.closest('.card-details-toggle-wrap');
      const region = document.getElementById('card-details-region');
      if (wrap && region) {
        const collapsed = wrap.classList.toggle('card-details-collapsed');
        toggle.setAttribute('aria-expanded', String(!collapsed));
        region.setAttribute('aria-hidden', String(collapsed));
        toggle.textContent = collapsed ? 'Show details' : 'Hide details';
      }
    }
    const moreBtn = e.target.closest('[data-action="expand-verdict"]');
    if (moreBtn) {
      const banner = document.querySelector('.alert-banner');
      if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
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

export function wireDynamicHandlers(data) {
  bindGlobalPrefetchHover();
  bindGlobalClickHandlers();
  bindCardToggles();

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
