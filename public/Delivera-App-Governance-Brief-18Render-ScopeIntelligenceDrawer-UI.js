import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { SCOPE_FILTER_PRESETS } from './Delivera-App-Governance-Brief-ScopeFilters-01SSOT.js';

function cardRow(card) {
  return `
    <li class="gov-scope-card gov-scope-card--${escapeHtml(card.health)}" data-project="${escapeHtml(card.projectKey)}">
      <span class="gov-scope-card-key">${escapeHtml(card.projectKey)}</span>
      <span class="gov-scope-card-label">${escapeHtml(card.label)}</span>
      <span class="gov-scope-card-meta">${card.epicCount} epics · ${card.blockerCount} blocked</span>
    </li>`;
}

export function openScopeIntelligenceDrawer(brief, { onApplyFilter } = {}) {
  const scope = brief?.meta?.scopeIntelligence || {};
  const cards = scope.cards || [];
  const filters = SCOPE_FILTER_PRESETS.map((f) => `
    <button type="button" class="gov-scope-filter-chip" data-filter="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`).join('');

  const body = `
    <p class="gov-scope-drawer-line">${escapeHtml(scope.capsuleLine || '')}</p>
    <div class="gov-scope-filter-row" role="group" aria-label="Scope filters">${filters}</div>
    <ul class="gov-scope-card-list" role="list">${cards.map(cardRow).join('')}</ul>
    ${scope.failedProjects ? `<p class="gov-scope-warn">${scope.failedProjects} project(s) could not load boards.</p>` : ''}`;

  const { close, el } = openRightDrawer({
    title: 'Scope intelligence',
    bodyHtml: `${body}<p><button type="button" class="btn btn-primary btn-compact" id="gov-scope-apply">Done</button></p>`,
  });

  el?.querySelectorAll('[data-filter]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      const id = btn.getAttribute('data-filter');
      el.querySelectorAll('.gov-scope-card').forEach((li) => {
        const health = li.className.includes('blocked') ? 'blocked' : '';
        const sprint = li.querySelector('.gov-scope-card-label')?.textContent || '';
        let show = true;
        if (id === 'blocked') show = li.classList.contains('gov-scope-card--blocked');
        else if (id === 'no-sprint') show = sprint.includes('no sprint');
        else if (id === 'pi-committed') show = (li.querySelector('.gov-scope-card-meta')?.textContent || '').includes('epics') && !sprint.includes('0 epics');
        else if (id === 'setup') show = li.classList.contains('gov-scope-card--setup');
        li.hidden = !show;
      });
      onApplyFilter?.(id);
    });
  });

  el?.querySelector('#gov-scope-apply')?.addEventListener('click', () => close());
  return { close, el };
}

export function scopeCapsuleCounts(brief) {
  const s = brief?.meta?.scopeIntelligence;
  if (!s) return null;
  return { available: s.available, noSprint: s.noSprint, piCommitted: s.piCommitted };
}
