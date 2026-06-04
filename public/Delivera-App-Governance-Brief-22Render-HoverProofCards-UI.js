import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

let popoverEl = null;

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
  const proof = evidenceRow?.proofSummary || risk?.proofLine || 'Evidence pending';
  const owner = risk?.decisionNeededFrom || risk?.owner || 'Unassigned';
  return `
    <p class="gov-proof-pop-title"><strong>${escapeHtml(key)}</strong> ${escapeHtml(title)}</p>
    <p><span class="gov-proof-pop-label">Why flagged</span> ${escapeHtml(risk?.riskLabel || risk?.riskType || '')}</p>
    <p><span class="gov-proof-pop-label">Proof</span> ${escapeHtml(String(proof).slice(0, 200))}</p>
    <p><span class="gov-proof-pop-label">Owner lane</span> ${escapeHtml(owner)}</p>
    <p><span class="gov-proof-pop-label">Next</span> ${escapeHtml(risk?.recommendedAction || 'Review in action cluster')}</p>`;
}

export function bindHoverProofCards(root, brief) {
  if (!root || !brief) return;
  const pop = ensurePopover();
  let hideTimer = null;

  const show = (target, html) => {
    clearTimeout(hideTimer);
    pop.innerHTML = html;
    pop.hidden = false;
    const rect = target.getBoundingClientRect();
    pop.style.top = `${Math.min(window.innerHeight - 120, rect.bottom + 8)}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 320, rect.left))}px`;
  };

  const hide = () => {
    hideTimer = setTimeout(() => { pop.hidden = true; }, 120);
  };

  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', hide);

  root.querySelectorAll('[data-issue-key], [data-proof-key], .gov-owner-chip').forEach((el) => {
    const key = el.getAttribute('data-issue-key') || el.getAttribute('data-proof-key')
      || el.textContent?.trim().match(/^[A-Z]+-\d+/)?.[0];
    if (!key) return;
    const risk = [...(brief.topRisks || []), ...(brief.risks || [])]
      .find((r) => String(r.issueKey).toUpperCase() === String(key).toUpperCase());
    const evidence = (brief.evidencePack?.rows || [])
      .find((r) => String(r.issueKey).toUpperCase() === String(key).toUpperCase());
    if (!risk && !evidence) return;

    el.addEventListener('mouseenter', () => show(el, proofCardHtml(risk, evidence)));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el, proofCardHtml(risk, evidence)));
    el.addEventListener('blur', hide);
  });
}
