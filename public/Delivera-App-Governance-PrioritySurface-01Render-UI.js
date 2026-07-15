/**
 * Priority Brief surface — single compose path for governance priority page.
 * Page layout: main column (hero → compare → commitments → exception) | sticky agentic rail.
 * Squad Comparison sits flush under the hero — aside is NOT a sibling of hero-only.
 * Bento status grammar: Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.
 */
import { renderPriorityBriefHero } from './Delivera-App-Governance-PriorityBrief-01Render-UI.js';
import { renderAgenticPanel } from './Delivera-App-Governance-AgenticPanel-01Render-UI.js';
import { renderExceptionRail, bindExceptionRail } from './Delivera-App-Governance-ExceptionRail-01Render-UI.js';
import { renderCommitmentDetail } from './Delivera-App-Governance-CommitmentDetail-01Render-UI.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOVERNANCE_DISPLACEMENT_LINE } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';
import { renderSquadCompareSkeletonHtml } from './Delivera-Shared-Instant-Shell-01UI.js';

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
      <div class="gov-priority-layout" data-testid="governance-priority-layout">
        <div class="gov-priority-main" data-testid="governance-priority-main">
          ${renderPriorityBriefHero(pbWithIntervention, decision)}
          ${renderSinceLastCheckStrip(brief)}
          <div class="gov-priority-carousel-slot" data-priority-carousel-slot="1" data-testid="governance-squad-comparison" data-compare-pending="1">
            ${renderSquadCompareSkeletonHtml()}
          </div>
          ${renderCommitmentDetail(pbWithIntervention)}
        </div>
        <div class="gov-priority-rail" data-testid="governance-priority-rail">
          ${renderAgenticPanel(pbWithIntervention, decision, { writesDisabled, cases })}
        </div>
      </div>
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

export function bindGovernancePrioritySurface(root, {
  brief = null,
  onInspectEvidence = null,
  onSelectSquad = null,
} = {}) {
  if (!root) return;
  bindExceptionRail(root, {
    onSelectSquad: (key) => {
      if (typeof onSelectSquad === 'function') onSelectSquad(key);
    },
  });
  const scrollTarget = () => root.querySelector(
    '[data-testid="governance-commitment-detail"], [data-testid="governance-commitment-above-fold"], .gov-priority-commitment-rail, [data-testid="governance-commitment-detail-fold"]'
  );
  const selectSquad = (key) => {
    if (!key) return;
    if (typeof onSelectSquad === 'function') onSelectSquad(key);
  };
  root.querySelectorAll('[data-governance-action="select-squad"][data-squad-key]').forEach((row) => {
    const activate = () => selectSquad(String(row.getAttribute('data-squad-key') || '').trim().toUpperCase());
    if (row.tagName === 'TR') {
      row.addEventListener('click', activate);
      row.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activate();
        }
      });
    }
  });
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
    // Journey actions are handled by handlePortfolioDelegatedClick on #main-content.
    const portfolioJourneys = new Set([
      'open-alignment-studio', 'upload-baseline-slide', 'align-board',
      'record-decision', 'review-prepared', 'share-sponsor-brief',
      'refresh-brief', 'open-baseline-image', 'view-prepared-items',
      'view-governance-evidence',
    ]);
    if (portfolioJourneys.has(action)) return;
    if (action === 'inspect-evidence' || action === 'open-evidence') {
      ev.preventDefault();
      if (typeof onInspectEvidence === 'function') {
        onInspectEvidence(brief);
        return;
      }
    }
    if (action === 'commitment-decision') {
      ev.preventDefault();
      ev.stopPropagation();
      if (btn.getAttribute('data-nudge-plan') === '1') {
        const key = btn.getAttribute('data-commitment-issue') || '';
        const title = btn.getAttribute('data-commitment-title') || key;
        const owner = btn.getAttribute('data-commitment-owner') || 'PO/SM';
        const msg = `${owner}: please plan stories under ${key}${title && title !== key ? ` (${title})` : ''} — this epic is on the PI plan and in Jira but has no stories on the selected boards yet.`;
        const toast = (text, tone = 'info') => {
          import('./Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js')
            .then((m) => m.showInlineToast?.(document.getElementById('main-content'), text, tone))
            .catch(() => {});
        };
        import('./Delivera-Shared-Clipboard-01Bridge.js')
          .then((m) => m.writeTextToClipboardWithFallback?.(msg))
          .then(() => toast('Planning nudge copied — paste to PO/SM'))
          .catch(() => toast(msg));
        return;
      }
      const issueKey = btn.getAttribute('data-commitment-issue') || '';
      if (issueKey && brief && typeof onInspectEvidence === 'function') {
        onInspectEvidence(brief);
      }
      return;
    }
    if (action === 'expand-commitment-detail') {
      ev.preventDefault();
      const overflow = root.querySelector('.gov-commitment-detail-overflow');
      if (overflow) {
        overflow.hidden = false;
        btn.hidden = true;
      }
    }
  });
}
