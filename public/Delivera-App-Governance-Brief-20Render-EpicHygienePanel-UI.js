import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';

export function renderAdHocChip(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  const n = adHoc.length;
  if (!n) {
    return `<button type="button" class="gov-adhoc-chip gov-adhoc-chip--zero" data-hover-proof="ad-hoc">${COPY.adHocChip}: 0</button>`;
  }
  const hint = escapeHtml(COPY.adHocChipHint || '');
  return `<button type="button" class="gov-adhoc-chip gov-adhoc-chip--alert" data-adhoc-open data-hover-proof="ad-hoc" title="${hint}">${COPY.adHocChip}: ${n}</button>`;
}

function openAdHocDrawer(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  const projectsCsv = (brief?.projects || []).join(',') || 'MPSA,MAS';
  const rows = adHoc.map((e) => `
    <li class="gov-adhoc-item">
      <strong>${escapeHtml(e.issueKey)}</strong>
      <span>${escapeHtml(e.summary || '')}</span>
      <span class="gov-adhoc-reason">${escapeHtml(e.reason || '')}</span>
      <select class="gov-adhoc-class" data-issue-key="${escapeHtml(e.issueKey)}" aria-label="Classify">
        <option value="unapproved-scope">Unapproved scope</option>
        <option value="operational-support">Operational support</option>
        <option value="incident">Incident</option>
        <option value="regulatory">Regulatory</option>
        <option value="executive-request">Executive request</option>
        <option value="pi-commitment">PI commitment</option>
      </select>
    </li>`).join('');
  openRightDrawer({
    title: `Ad-hoc epics (${adHoc.length})`,
    bodyHtml: `<ul class="gov-adhoc-list">${rows}</ul>
      <div class="gov-baseline-actions">
        <button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create PI epic work in Jira.">Create work</button>
      </div>`,
  });
}

export function openSuggestionsDrawer(brief) {
  const suggestions = brief?.meta?.epicHygiene?.suggestions || [];
  const rows = suggestions.map((s) => `
    <li class="gov-epic-suggestion-row">
      <p><strong>${escapeHtml(s.issueKey)}</strong></p>
      <p class="gov-epic-current">${escapeHtml(s.current)}</p>
      <p class="gov-epic-suggested">→ ${escapeHtml(s.suggested || '')}</p>
      <button type="button" class="btn btn-secondary btn-compact" data-copy-suggest="${escapeHtml(s.suggested || '')}">Copy suggested name</button>
    </li>`).join('');
  const { el, close } = openRightDrawer({
    title: 'Epic name suggestions',
    bodyHtml: `<ul class="gov-epic-suggestions-drawer">${rows || '<li>No suggestions</li>'}</ul>`,
  });
  el?.querySelectorAll('[data-copy-suggest]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.getAttribute('data-copy-suggest') || '');
        btn.textContent = 'Copied';
      } catch (_) { btn.textContent = 'Copy failed'; }
    });
  });
  return { close, el };
}

/** Inline row for PI strip (J4). */
export function renderEpicHygieneInlineRow(brief) {
  const hygiene = brief?.meta?.epicHygiene;
  if (!hygiene || hygiene.epicCount === 0) return '';
  const weak = (hygiene.weak || []).length;
  const squadChips = (hygiene.bySquad || []).slice(0, 4).map((r) => `
    <span class="gov-epic-score-chip" data-hover-proof="epic-score">${escapeHtml((r.squad || '').split(' ')[0])} ${r.score}%</span>`).join('');
  return `
    <div class="gov-pi-hygiene-row" data-hover-proof="epic-hygiene">
      <span class="gov-epic-score-main">Epic naming <strong>${hygiene.score != null ? `${hygiene.score}%` : '—'}</strong></span>
      <span class="gov-epic-meta-chip">Weak: ${weak}</span>
      ${squadChips}
      <button type="button" class="btn btn-link btn-compact" id="gov-epic-suggestions-open">Suggestions →</button>
    </div>`;
}

export function renderEpicHygienePanel(brief) {
  return '';
}

export function bindEpicHygieneInteractions(root, brief) {
  if (!root || !brief) return;
  root.querySelector('#gov-epic-suggestions-open')?.addEventListener('click', () => openSuggestionsDrawer(brief));
  root.querySelectorAll('[data-adhoc-open]').forEach((btn) => {
    btn.addEventListener('click', () => openAdHocDrawer(brief));
  });
}

export function renderAdHocEpicWatcher() {
  return '';
}
