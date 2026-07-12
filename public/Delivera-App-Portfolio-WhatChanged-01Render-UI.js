/**
 * Portfolio "What changed" timeline — fills the right rail with a live feed
 * of changes since the user's last visit. Reuses brief.meta.sinceLastRun data.
 * Eliminates the empty right-rail dead zone on large desktop viewports.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const CHANGE_ICONS = {
  risk: '⚠️',
  blocker: '🚫',
  resolved: '✅',
  status: '🔄',
  scope: '🎯',
  commitment: '📌',
  evidence: '🔍',
  default: '•',
};

function changeIcon(change = {}) {
  const type = String(change.type || change.category || '').toLowerCase();
  for (const [key, glyph] of Object.entries(CHANGE_ICONS)) {
    if (key === 'default') continue;
    if (type.includes(key)) return glyph;
  }
  return CHANGE_ICONS.default;
}

function renderTimelineItem(change = {}, idx = 0) {
  const icon = changeIcon(change);
  const label = change.label || change.title || change.summary || 'Change detected';
  const detail = change.detail || change.description || '';
  const when = change.when || change.timestamp || '';
  const whenLabel = when ? formatHumanAge(when) : '';
  return `
    <li class="portfolio-changelog-item${idx === 0 ? ' is-latest' : ''}" data-testid="portfolio-changelog-item">
      <span class="portfolio-changelog-icon" aria-hidden="true">${icon}</span>
      <div class="portfolio-changelog-body">
        <strong class="portfolio-changelog-label">${escapeHtml(String(label).slice(0, 120))}</strong>
        ${detail ? `<p class="portfolio-changelog-detail">${escapeHtml(String(detail).slice(0, 200))}</p>` : ''}
        ${whenLabel ? `<span class="portfolio-changelog-when">${escapeHtml(whenLabel)}</span>` : ''}
      </div>
    </li>`;
}

export function renderWhatChangedTimeline(brief = {}, decision = {}) {
  const sinceLastRun = brief?.meta?.sinceLastRun || {};
  const summary = sinceLastRun.summary || '';
  const changes = sinceLastRun.changes || sinceLastRun.items || [];
  const changeCount = sinceLastRun.changeCount || changes.length || 0;

  // If no sinceLastRun data, fall back to decision drivers as a "why this matters" feed
  if (!changeCount && !changes.length) {
    const drivers = (decision.drivers || []).slice(0, 3);
    if (!drivers.length) {
      return `
        <section class="portfolio-changelog portfolio-changelog--empty" aria-label="What changed" data-testid="portfolio-changelog">
          <h2 class="portfolio-changelog-title">What changed</h2>
          <p class="portfolio-changelog-empty">No changes since your last visit. We'll surface updates here as they happen.</p>
        </section>`;
    }
    return `
      <section class="portfolio-changelog" aria-label="What changed" data-testid="portfolio-changelog">
        <h2 class="portfolio-changelog-title">What changed</h2>
        <ul class="portfolio-changelog-list">
          ${drivers.map((d, i) => renderTimelineItem({
            type: d.type || 'status',
            label: d.title || 'Signal',
            detail: d.summary || '',
            when: '',
          }, i)).join('')}
        </ul>
      </section>`;
  }

  const visibleChanges = changes.slice(0, 5);
  const overflow = changes.length - visibleChanges.length;

  return `
    <section class="portfolio-changelog" aria-label="What changed" data-testid="portfolio-changelog">
      <h2 class="portfolio-changelog-title">What changed${changeCount ? ` <span class="portfolio-changelog-count" data-testid="portfolio-changelog-count">${changeCount}</span>` : ''}</h2>
      ${summary ? `<p class="portfolio-changelog-summary" data-testid="portfolio-changelog-summary">${escapeHtml(String(summary).slice(0, 200))}</p>` : ''}
      <ul class="portfolio-changelog-list" data-testid="portfolio-changelog-list">
        ${visibleChanges.map((c, i) => renderTimelineItem(c, i)).join('')}
      </ul>
      ${overflow > 0 ? `<button type="button" class="btn btn-link btn-compact portfolio-changelog-more" data-testid="portfolio-changelog-more">+${overflow} more changes</button>` : ''}
    </section>`;
}
