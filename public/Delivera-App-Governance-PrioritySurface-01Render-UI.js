/**
 * Priority Brief surface — single compose path for governance priority page.
 * Hero + agentic + exception + commitments + carousel slot (no parallel paint).
 * Bento status grammar: Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.
 */
import { renderPriorityBriefHero } from './Delivera-App-Governance-PriorityBrief-01Render-UI.js';
import { renderAgenticPanel } from './Delivera-App-Governance-AgenticPanel-01Render-UI.js';
import { renderExceptionRail, bindExceptionRail } from './Delivera-App-Governance-ExceptionRail-01Render-UI.js';
import { renderCommitmentDetail } from './Delivera-App-Governance-CommitmentDetail-01Render-UI.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOVERNANCE_DISPLACEMENT_LINE } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

export function renderGovernancePrioritySurface(decision = {}, brief = {}, { cases = [] } = {}) {
  const pb = decision.priorityBrief || {};
  const judgment = decision.portfolioJudgment || pb.portfolioJudgment || {};
  const writesDisabled = Boolean(pb.writesDisabled || decision._cachedView);
  const pbWithIntervention = {
    ...pb,
    interventionSummary: decision.interventionSummary || '',
  };
  const selectedKey = String(decision.anchorProject || '').toUpperCase();

  return `
    <div class="gov-priority-surface" data-testid="governance-priority-surface" data-governance-surface="priority-brief">
      <p class="gov-displacement-line" data-testid="governance-displacement-line">${escapeHtml(GOVERNANCE_DISPLACEMENT_LINE)}</p>
      <div class="gov-priority-cockpit-grid gov-priority-hero-grid">
        ${renderPriorityBriefHero(pbWithIntervention, decision)}
        ${renderAgenticPanel(pbWithIntervention, decision, { writesDisabled, cases })}
      </div>
      ${renderExceptionRail(judgment, { selectedKey })}
      ${renderCommitmentDetail(pbWithIntervention)}
      ${renderSinceLastCheckStrip(brief)}
      <div class="gov-priority-carousel-slot" data-priority-carousel-slot="1" data-testid="governance-squad-comparison"></div>
      ${decision.sponsorBriefMarkdown ? `<div class="gov-sponsor-brief-preview" data-testid="governance-sponsor-brief-preview" hidden><pre>${escapeHtml(decision.sponsorBriefMarkdown)}</pre></div>` : ''}
    </div>`;
}

function renderSinceLastCheckStrip(brief = {}) {
  const sinceLastRun = brief?.meta?.sinceLastRun || {};
  const changes = sinceLastRun.changes || sinceLastRun.items || [];
  if (!changes.length) return '';
  const recovered = changes.filter((c) => /recover|resolved|done|fixed/i.test(String(c.type || c.label || ''))).length;
  const newBlocked = changes.filter((c) => /block|risk|stall|exposed/i.test(String(c.type || c.label || ''))).length;
  const unchanged = Math.max(0, changes.length - recovered - newBlocked);
  const items = [];
  if (newBlocked > 0) items.push(`<span class="gov-since-blocked">${newBlocked} new blocker${newBlocked === 1 ? '' : 's'}</span>`);
  if (recovered > 0) items.push(`<span class="gov-since-recovered">${recovered} recovered</span>`);
  if (unchanged > 0) items.push(`<span class="gov-since-unchanged">${unchanged} unchanged</span>`);
  if (!items.length) return '';
  return `
    <div class="gov-since-last-check" data-testid="governance-since-last-check">
      <span class="gov-since-label">Since last check</span>
      ${items.join(' · ')}
    </div>`;
}

export function bindGovernancePrioritySurface(root, { brief = null, onInspectEvidence = null } = {}) {
  if (!root) return;
  bindExceptionRail(root);
  const scrollTarget = () => root.querySelector(
    '[data-testid="governance-commitment-detail"], [data-testid="governance-commitment-above-fold"], .gov-priority-commitment-rail, [data-testid="governance-commitment-detail-fold"]'
  );
  root.querySelectorAll('.gov-priority-at-risk-row[data-governance-action="scroll-commitments"]').forEach((row) => {
    const activate = () => {
      const target = scrollTarget();
      if (!target) return;
      target.removeAttribute('hidden');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        activate();
      }
    });
  });
  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-governance-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-governance-action');
    if (action === 'inspect-evidence' || action === 'open-evidence') {
      ev.preventDefault();
      if (typeof onInspectEvidence === 'function') {
        onInspectEvidence(brief);
        return;
      }
    }
  });
}
