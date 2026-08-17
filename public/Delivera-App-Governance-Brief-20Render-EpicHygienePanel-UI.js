import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { renderIssueIdentityHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderAdHocChip(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  const n = adHoc.length;
  if (!n) {
    return `<button type="button" class="gov-adhoc-chip gov-adhoc-chip--zero" data-hover-proof="ad-hoc">${COPY.adHocChip}: 0</button>`;
  }
  const nonAligned = adHoc.filter((e) => e.formatAligned === false).length;
  const hint = escapeHtml(
    nonAligned
      ? `${COPY.adHocChipHint || ''} · ${nonAligned} without FY/Qn – Squad – Platform – Title naming`
      : (COPY.adHocChipHint || ''),
  );
  return `<button type="button" class="gov-adhoc-chip gov-adhoc-chip--alert" data-adhoc-open data-hover-proof="ad-hoc" title="${hint}">${COPY.adHocChip}: ${n}${nonAligned ? ` · ${nonAligned} non-aligned` : ''}</button>`;
}

/** Merged Alignment chip — ad-hoc + epic hygiene SSOT in one hero control. */
export function renderAlignmentChip(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  const hygiene = brief?.meta?.epicHygiene;
  const adHocN = adHoc.length;
  const nonAligned = adHoc.filter((e) => e.formatAligned === false).length;
  const weak = (hygiene?.weak || []).length;
  const score = hygiene?.score;
  const parts = [];
  if (score != null) parts.push(`Naming ${score}%`);
  if (adHocN) parts.push(`${adHocN} ad-hoc`);
  if (nonAligned) parts.push(`${nonAligned} misaligned`);
  if (weak) parts.push(`${weak} weak`);
  const label = parts.length ? parts.join(' · ') : (COPY.alignmentChipOk || 'Alignment OK');
  const alert = adHocN > 0 || weak > 0 || (score != null && score < 70);
  if (!alert) return '';
  const hint = escapeHtml([
    COPY.alignmentChipHint || 'Epic naming vs PI baseline',
    nonAligned ? `${nonAligned} without FY/Qn naming` : '',
  ].filter(Boolean).join(' · '));
  return `<button type="button" class="gov-alignment-chip${alert ? ' gov-alignment-chip--alert' : ''}" data-adhoc-open data-hover-proof="alignment" title="${hint}">${escapeHtml(COPY.alignmentChip || 'Alignment')}: ${escapeHtml(label)}</button>`;
}

function openAdHocDrawer(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  const projectsCsv = (brief?.projects || []).join(',') || 'MPSA,MAS';
  const rows = adHoc.map((e) => `
    <li class="gov-adhoc-item${e.formatAligned === false ? ' is-format-misaligned' : ''}">
      ${renderIssueIdentityHtml(e.issueKey, { title: e.title || e.summary || '' })}
      <span class="gov-adhoc-reason">${escapeHtml(e.reason || '')}${e.formatAligned === false ? ' · Naming not PI-aligned' : ''}</span>
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
    bodyHtml: `<p class="gov-adhoc-ssot-hint">Aligned naming: <code>FY27 Q2 – Squad – Platform – Commitment title</code>. Non-aligned titles are treated as ad-hoc / slip signals.</p>
      <ul class="gov-adhoc-list">${rows}</ul>
      <div class="gov-baseline-actions">
        <button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create PI epic work in Jira.">Create work</button>
      </div>`,
  });
}

export function openSuggestionsDrawer(brief) {
  const suggestions = brief?.meta?.epicHygiene?.suggestions || [];
  const rows = suggestions.map((s) => `
    <li class="gov-epic-suggestion-row">
      <p>${renderIssueIdentityHtml(s.issueKey, { title: s.current || s.suggested || '' })}</p>
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

export function renderEpicHygienePanel() {
  return '';
}

export function bindEpicHygieneInteractions(root, brief) {
  if (!root || !brief) return;
  root.__deliveraHygieneBrief = brief;
  if (root.dataset.hygieneBound === '1') return;
  root.dataset.hygieneBound = '1';
  root.addEventListener('click', (event) => {
    const current = root.__deliveraHygieneBrief;
    if (!current) return;
    if (event.target.closest('#gov-epic-suggestions-open')) openSuggestionsDrawer(current);
    if (event.target.closest('[data-adhoc-open]')) openAdHocDrawer(current);
  });
}

export function renderAdHocEpicWatcher() {
  return '';
}
