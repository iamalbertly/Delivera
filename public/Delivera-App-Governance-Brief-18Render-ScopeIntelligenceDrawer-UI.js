import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { SCOPE_FILTER_PRESETS } from './Delivera-App-Governance-Brief-ScopeFilters-01SSOT.js';

function cardRow(card) {
  const sprint = card.sprint || 'none';
  const selected = card.isSelected ? 'true' : 'false';
  return `
    <li class="gov-scope-card gov-scope-card--${escapeHtml(card.health)}"
        data-project="${escapeHtml(card.projectKey)}"
        data-sprint="${escapeHtml(sprint)}"
        data-health="${escapeHtml(card.health)}"
        data-epic-count="${card.epicCount || 0}"
        data-blocker-count="${card.blockerCount || 0}"
        data-is-selected="${selected}">
      <span class="gov-scope-card-key">${escapeHtml(card.projectKey)}</span>
      <span class="gov-scope-card-state">${escapeHtml(sprint === 'none' ? 'No sprint' : sprint === 'active' ? 'Active' : 'Closed')}</span>
      <span class="gov-scope-card-meta">${card.epicCount} PI · ${card.blockerCount} blocked</span>
      ${card.isSelected ? '<span class="gov-scope-selected-chip">Selected</span>' : '<span class="gov-scope-hidden-chip">Not selected</span>'}
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
    ${scope.failedProjects ? `<p class="gov-scope-warn">${scope.failedProjects} project(s) could not load boards.</p>` : ''}
    ${(scope.projectErrors || []).map((e) => `<p class="gov-scope-warn">${escapeHtml(e.projectKey)}: ${escapeHtml(e.error || 'unavailable')}</p>`).join('')}`;

  const { close, el } = openRightDrawer({
    title: 'Scope intelligence',
    bodyHtml: `${body}<p><button type="button" class="btn btn-primary btn-compact" id="gov-scope-apply">Done</button></p>`,
  });

  el?.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      const id = btn.getAttribute('data-filter');
      el.querySelectorAll('.gov-scope-card').forEach((li) => {
        const sprint = li.getAttribute('data-sprint') || '';
        const health = li.getAttribute('data-health') || '';
        const epicCount = Number(li.getAttribute('data-epic-count')) || 0;
        let show = id === 'all';
        if (id === 'blocked') show = health === 'blocked';
        else if (id === 'no-sprint') show = sprint === 'none';
        else if (id === 'pi-committed') show = epicCount > 0;
        else if (id === 'setup') show = health === 'setup';
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
  return { available: s.available, noSprint: s.noSprint, piCommitted: s.piCommitted, blocked: s.blocked };
}
