import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';
import { freshnessShortLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

let popoverEl = null;
let pinned = false;

function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'gov-proof-popover';
  popoverEl.setAttribute('role', 'tooltip');
  popoverEl.hidden = true;
  document.body.appendChild(popoverEl);
  return popoverEl;
}

function proofCardHtml(risk, evidenceRow) {
  const key = risk?.issueKey || evidenceRow?.issueKey || '';
  const title = risk?.displayTitle || risk?.riskLabel || evidenceRow?.title || key;
  const proof = evidenceRow?.proofSummary || evidenceRow?.whyFlagged || risk?.proofLine || risk?.evidence || 'Evidence pending';
  const owner = risk?.decisionNeededFrom || risk?.owner || 'Unassigned';
  return `
    <p class="gov-proof-pop-title"><strong>${escapeHtml(key)}</strong> ${escapeHtml(title)}</p>
    <p><span class="gov-proof-pop-label">Why flagged</span> ${escapeHtml(risk?.riskLabel || risk?.riskType || '')}</p>
    <p><span class="gov-proof-pop-label">Proof</span> ${escapeHtml(String(proof).slice(0, 200))}</p>
    <p><span class="gov-proof-pop-label">Owner lane</span> ${escapeHtml(owner)}</p>
    <p><span class="gov-proof-pop-label">Next</span> ${escapeHtml(risk?.recommendedAction || 'Review in action cluster')}</p>`;
}

const STATIC_HELP = {
  'pi-gauge': () => `<p><strong>PI baseline</strong></p><p>${GOV_TOOLTIPS.piConfidence}</p><p>Without baseline: carryover and removed scope cannot be proven.</p>`,
  'pi-candidates': (brief) => {
    const c = brief?.meta?.piConfidence?.counts || {};
    const n = (c.offPlan || 0) + (c.onTrack || 0);
    return `<p><strong>Candidates (${n})</strong></p><p>Not yet confirmed in PI baseline. Set baseline to classify as committed or removed.</p>`;
  },
  'evidence-count': (brief) => {
    const n = (brief?.evidencePack?.rows || []).length;
    return `<p><strong>Evidence: ${n}</strong></p><p>${n} issue keys checked against sprint and changelog.</p>`;
  },
  'owner-lane': (brief) => {
    const top = brief?.topRisks?.[0] || {};
    return `<p><strong>Owner lane</strong></p><p>${escapeHtml(top.decisionNeededFrom || 'Scrum Master')}</p><p>Why: ${escapeHtml(top.riskLabel || 'risk needs lane decision')}</p>`;
  },
  'setup-gap': () => `<p><strong>Setup gap</strong></p><p>${GOV_TOOLTIPS.piConfidence}</p>`,
  'safe-send': (brief) => {
    const b = sendReadinessBadge(brief);
    return `<p><strong>${escapeHtml(b.label)}</strong></p><p>Claims verified against evidence pack.</p>`;
  },
  'ad-hoc': () => `<p><strong>Ad-hoc epic</strong></p><p>${GOV_TOOLTIPS.adHocEpic}</p>`,
  'epic-score': () => `<p><strong>Epic naming</strong></p><p>Score based on FY/Q structured naming pattern.</p>`,
  'epic-hygiene': () => `<p><strong>Epic hygiene</strong></p><p>Weak names reduce PI confidence in forums.</p>`,
  'since-last-run': (brief) => `<p><strong>Since last check</strong></p><p>${escapeHtml(brief?.meta?.sinceLastRun?.summary || 'No change recorded')}</p>`,
  trust: (brief) => `<p><strong>Trust</strong></p><p>Freshness: ${escapeHtml(freshnessShortLabel(brief?.freshness || {}))}. Narration: ${escapeHtml(brief?.meta?.narratedBy || 'template')}.</p>`,
  freshness: (brief) => `<p><strong>Data</strong></p><p>${escapeHtml(freshnessShortLabel(brief?.freshness || {}))}</p>`,
  ai: () => `<p><strong>AI narration</strong></p><p>${GOV_TOOLTIPS.narrationAdvisor}</p>`,
  status: (brief) => `<p><strong>Status</strong></p><p>${escapeHtml(brief?.executiveView?.verdictLine || '')}</p>`,
};

function bindHoverEl(el, brief, getHtml) {
  const pop = ensurePopover();
  let hideTimer = null;
  const show = () => {
    clearTimeout(hideTimer);
    pop.innerHTML = typeof getHtml === 'function' ? getHtml(brief) : getHtml;
    pop.hidden = false;
    const rect = el.getBoundingClientRect();
    pop.style.top = `${Math.min(window.innerHeight - 140, rect.bottom + 8)}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 320, rect.left))}px`;
  };
  const hide = () => {
    if (pinned) return;
    hideTimer = setTimeout(() => { pop.hidden = true; }, 150);
  };
  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  el.addEventListener('focus', show);
  el.addEventListener('blur', hide);
  el.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    pinned = !pinned;
    if (pinned) show();
    else { pop.hidden = true; pinned = false; }
  }, { passive: false });
}

export function bindHoverProofCards(root, brief) {
  if (!root || !brief) return;
  const pop = ensurePopover();
  pop.addEventListener('mouseenter', () => clearTimeout());
  pop.addEventListener('mouseleave', () => { if (!pinned) pop.hidden = true; });
  document.addEventListener('touchstart', (ev) => {
    if (pinned && !ev.target.closest('.gov-proof-popover') && !ev.target.closest('[data-hover-proof]')) {
      pinned = false;
      pop.hidden = true;
    }
  }, { passive: true });

  Object.keys(STATIC_HELP).forEach((key) => {
    root.querySelectorAll(`[data-hover-proof="${key}"]`).forEach((el) => {
      bindHoverEl(el, brief, STATIC_HELP[key]);
    });
  });

  root.querySelectorAll('[data-issue-key], [data-proof-key], .gov-cluster-issue-key').forEach((el) => {
    const key = el.getAttribute('data-issue-key') || el.textContent?.trim().match(/^[A-Z]+-\d+/)?.[0];
    if (!key) return;
    const risk = [...(brief.topRisks || []), ...(brief.risks || []), ...(brief.portfolioRisks || [])]
      .find((r) => String(r.issueKey).toUpperCase() === String(key).toUpperCase());
    const evidence = (brief.evidencePack?.rows || [])
      .find((r) => String(r.issueKey).toUpperCase() === String(key).toUpperCase());
    if (!risk && !evidence) return;
    bindHoverEl(el, brief, () => proofCardHtml(risk, evidence));
  });
}
