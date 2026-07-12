/**
 * Priority Brief hero — left column of governance answer surface.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';

function renderAtRiskRows(atRiskSquads = [], commitmentRows = []) {
  const rows = (atRiskSquads || []).slice(0, 3);
  if (!rows.length) return '';
  return `
    <table class="gov-priority-at-risk-table" data-testid="governance-at-risk-table">
      <thead>
        <tr><th scope="col">Squad</th><th scope="col">State</th><th scope="col">Meaning</th><th scope="col"><span class="sr-only">Action</span></th></tr>
      </thead>
      <tbody>
        ${rows.map((s) => {
          const tone = s.attentionState === 'off-plan' || s.attentionState === 'decision-required' ? 'critical' : 'watch';
          return `
          <tr class="gov-priority-at-risk-row gov-priority-at-risk-row--${escapeHtml(tone)}" data-squad-key="${escapeHtml(s.projectKey)}" data-governance-squad-select="${escapeHtml(s.projectKey)}" tabindex="0" role="button">
            <td><strong>${escapeHtml(s.squadName || s.projectKey)}</strong></td>
            <td><span class="gov-status-rail gov-status-rail--${escapeHtml(tone)}">${escapeHtml(s.attentionLabel || '')}</span></td>
            <td>${escapeHtml(s.meaning || '')}</td>
            <td><button type="button" class="btn btn-link btn-compact" data-governance-action="inspect-squad" data-squad-key="${escapeHtml(s.projectKey)}">Open evidence</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderBaselineProvenance(provenance = {}) {
  if (!provenance.available) {
    return `
      <p class="gov-baseline-provenance gov-baseline-provenance--missing" data-testid="governance-baseline-provenance">
        <strong>${escapeHtml(provenance.line || 'Alignment cannot be verified')}</strong>
        <button type="button" class="btn btn-link btn-compact" data-portfolio-action="open-alignment-studio">Attach or select quarter baseline</button>
      </p>`;
  }
  const actions = [];
  if (provenance.sourceType === 'slide' || provenance.sourceImagePath) {
    actions.push('<button type="button" class="btn btn-link btn-compact" data-governance-action="open-baseline-image">Open original baseline image</button>');
  }
  if (provenance.unsupported > 0) {
    actions.push(`<button type="button" class="btn btn-link btn-compact" data-governance-action="inspect-unsupported">Compare ${provenance.unsupported} unsupported promise${provenance.unsupported === 1 ? '' : 's'} with Jira</button>`);
  }
  return `
    <div class="gov-baseline-provenance" data-testid="governance-baseline-provenance">
      <p><strong>${escapeHtml(provenance.line || '')}</strong></p>
      <p>${escapeHtml(provenance.countsLine || '')}</p>
      ${actions.length ? `<div class="gov-baseline-provenance-actions">${actions.join('')}</div>` : ''}
    </div>`;
}

export function renderPriorityBriefHero(priorityBrief = {}, decision = {}) {
  const pb = priorityBrief || {};
  const exposure = pb.exposureLine
    ? `<p class="gov-priority-exposure" data-testid="governance-priority-exposure"><span class="gov-status-rail gov-status-rail--critical" aria-hidden="true"></span>${escapeHtml(pb.exposureLine)}</p>`
    : '';
  const causes = (pb.causeLines || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const reviewDue = pb.humanDecision?.dueAt
    ? `<p class="gov-priority-review-due"><span aria-hidden="true">📅</span> Next review: <strong>${escapeHtml(pb.humanDecision.dueAt)}</strong></p>`
    : '';

  return `
    <section class="gov-priority-brief-hero" data-testid="governance-priority-brief" aria-label="Priority governance brief">
      <div class="gov-priority-brief-left">
        <h1 class="gov-priority-headline" data-testid="governance-priority-headline">${escapeHtml(pb.headline || 'Governance status loading')}</h1>
        ${exposure}
        ${causes ? `<ul class="gov-priority-cause-list" data-testid="governance-priority-cause">${causes}</ul>` : ''}
        ${reviewDue}
        ${renderAtRiskRows(pb.atRiskSquads, pb.detailRows)}
        ${renderBaselineProvenance(pb.baselineProvenance)}
      </div>
    </section>`;
}

export function renderPriorityBriefSkeleton() {
  return `
    <section class="gov-priority-brief-hero gov-priority-brief-hero--skeleton" data-testid="governance-priority-brief" aria-busy="true">
      <h1 class="gov-priority-headline">Preparing governance brief…</h1>
    </section>`;
}
