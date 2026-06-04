import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

export function renderEpicHygienePanel(brief) {
  const hygiene = brief?.meta?.epicHygiene;
  if (!hygiene || hygiene.epicCount === 0) return '';
  const rows = (hygiene.bySquad || []).map((r) => `
    <li><strong>${escapeHtml(r.squad)}</strong> ${r.score}% (${r.epicCount} epics)</li>`).join('');
  const suggestions = (hygiene.suggestions || []).slice(0, 3).map((s) => `
    <li class="gov-epic-suggestion">
      <span>${escapeHtml(s.issueKey)}: ${escapeHtml(s.current)}</span>
      <em>→ ${escapeHtml(s.suggested || '')}</em>
    </li>`).join('');

  return `
    <section class="gov-epic-hygiene" aria-label="Epic hygiene">
      <h3 class="governance-subsection-title">Epic hygiene ${hygiene.score != null ? `${hygiene.score}%` : ''}</h3>
      <p class="gov-epic-summary">${escapeHtml(hygiene.summaryLine || '')}</p>
      <ul class="gov-epic-squad-scores">${rows}</ul>
      ${suggestions ? `<ul class="gov-epic-suggestions">${suggestions}</ul>` : ''}
    </section>`;
}

export function renderAdHocEpicWatcher(brief) {
  const adHoc = brief?.meta?.adHocEpics || [];
  if (!adHoc.length) return '';
  const rows = adHoc.slice(0, 5).map((e) => `
    <li class="gov-adhoc-item" data-issue-key="${escapeHtml(e.issueKey)}">
      <strong>${escapeHtml(e.issueKey)}</strong>
      <span>${escapeHtml(e.summary || '')}</span>
      <span class="gov-adhoc-reason">${escapeHtml(e.reason || '')}</span>
      <select class="gov-adhoc-class" data-issue-key="${escapeHtml(e.issueKey)}" aria-label="Classify epic">
        <option value="unapproved-scope">Unapproved scope</option>
        <option value="operational-support">Operational support</option>
        <option value="incident">Incident</option>
        <option value="regulatory">Regulatory</option>
        <option value="executive-request">Executive request</option>
        <option value="pi-commitment">PI commitment</option>
      </select>
    </li>`).join('');

  return `
    <details class="gov-adhoc-watcher">
      <summary>Ad-hoc epic watcher (${adHoc.length})</summary>
      <ul class="gov-adhoc-list">${rows}</ul>
    </details>`;
}
