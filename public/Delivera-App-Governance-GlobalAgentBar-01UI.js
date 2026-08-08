import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { ensureSubChromeSlot, SUB_CHROME_SLOT_ID } from './Delivera-Shared-Top-Chrome-01Render-UI.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { COPY, firstNameFromDisplay, verdictTierFromBrief } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

let stickyMount = null;
let globalBarEl = null;
let lastBriefRef = null;

export function mountGlobalAgentBar() {
  if (document.body?.classList?.contains('governance-page')) return null;
  if (globalBarEl) return globalBarEl;
  const slot = ensureSubChromeSlot() || document.getElementById(SUB_CHROME_SLOT_ID);
  if (!slot) return null;
  globalBarEl = document.createElement('div');
  globalBarEl.id = 'gov-global-agent-bar';
  globalBarEl.className = 'gov-global-agent-bar';
  globalBarEl.setAttribute('role', 'status');
  globalBarEl.setAttribute('aria-live', 'polite');
  globalBarEl.hidden = true;
  slot.appendChild(globalBarEl);
  return globalBarEl;
}

export function updateGlobalAgentBar(brief) {
  const bar = mountGlobalAgentBar();
  if (!bar || document.body?.classList?.contains('governance-page')) {
    if (bar) bar.hidden = true;
    document.body.classList.remove('has-sub-chrome');
    return;
  }
  if (!brief) {
    bar.hidden = true;
    document.body.classList.remove('has-sub-chrome');
    return;
  }
  const receipt = brief?.meta?.workerReceipt || {};
  const inbox = receipt.inboxTotal ?? receipt.pendingCount ?? 0;
  const gaps = (brief?.meta?.setupGaps || []).length;
  const piRaw = brief?.meta?.piConfidence?.headline || '';
  const piLower = String(piRaw).toLowerCase();
  // Hide untrusted wallpaper unless Gaps give a one-click path.
  const showPi = piRaw && !/not trusted|n\/a|unavailable/i.test(piLower)
    ? `<span class="gov-global-pill">${escapeHtml(piRaw.slice(0, 50))}</span>`
    : (gaps > 0 ? `<span class="gov-global-pill">Gaps ${gaps} · fix setup</span>` : '');
  const since = brief?.meta?.sinceLastRun?.summary || '';
  const po = brief?.meta?.poReadiness || brief?.poReadiness;
  const poPill = po?.score != null
    ? `<span class="gov-global-pill">PO ${Math.round(po.score)}%</span>`
    : '';
  const deltaPill = since
    ? `<span class="gov-global-pill gov-since-delta">${escapeHtml(since.slice(0, 60))}</span>`
    : (inbox > 0 ? `<span class="gov-global-pill">Brief queue: ${inbox}</span>` : '');
  const piShowsGaps = gaps > 0 && !piRaw;
  const gapsPill = (gaps > 0 && !piShowsGaps && !/Gaps/i.test(showPi))
    ? `<span class="gov-global-pill">Gaps ${gaps}</span>`
    : '';
  bar.innerHTML = `
    ${deltaPill}
    ${poPill}
    ${gapsPill}
    ${showPi}`;
  const hasContent = Boolean(bar.textContent.trim());
  bar.hidden = !hasContent;
  document.body.classList.toggle('has-sub-chrome', hasContent);
}

export function mountStickyMicroAnswer(mount) {
  stickyMount = mount;
  if (!mount) return;
  mount.className = 'gov-sticky-answer gov-sticky-answer--governance';
  mount.hidden = true;
  mount.setAttribute('aria-live', 'polite');
  if (!mount.dataset.stickyCopyBound) {
    mount.dataset.stickyCopyBound = '1';
    mount.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-sticky-copy]')) {
        document.dispatchEvent(new CustomEvent('delivera-gov-copy-answer'));
      }
    });
  }
}

export function updateStickyMicroAnswer(brief) {
  if (!stickyMount) return;
  lastBriefRef = brief;
  if (!brief) {
    stickyMount.hidden = true;
    stickyMount.innerHTML = '';
    return;
  }
  const onGovernance = document.body?.classList?.contains('governance-page');
  const ev = brief?.executiveView || {};
  const top = brief?.topRisks?.[0] || {};
  const tier = verdictTierFromBrief(brief);
  const owner = firstNameFromDisplay(top.assigneeName || top.decisionNeededFrom) || COPY.unassigned;
  const sentence = commandAnswerSentence(brief).slice(0, 80);
  if (onGovernance) {
    stickyMount.innerHTML = `
      <span class="gov-sticky-answer-tier gov-sticky-answer-tier--${escapeHtml(tier)}">${escapeHtml(tier)}</span>
      <span class="gov-sticky-answer-line">${escapeHtml(sentence || `${owner} · ${tier}`)}</span>
      <button type="button" class="btn btn-secondary btn-compact gov-sticky-copy" data-sticky-copy="1">Copy answer</button>`;
    stickyMount.removeAttribute('hidden');
    return;
  }
  const line = `${ev.verdictTier || 'watch'} · ${owner} · ${(brief?.meta?.setupGaps || []).length ? 'setup gap' : 'ok'}`;
  stickyMount.textContent = line.slice(0, 120);
  stickyMount.hidden = !line;
}

export function bindStickyScroll(showAfterPx = 120) {
  const onScroll = () => {
    if (!stickyMount) return;
    const show = window.scrollY > showAfterPx;
    stickyMount.classList.toggle('is-visible', show);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
