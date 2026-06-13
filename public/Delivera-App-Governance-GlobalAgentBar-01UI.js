import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { ensureSubChromeSlot, SUB_CHROME_SLOT_ID } from './Delivera-Shared-Top-Chrome-01Render-UI.js';
import { COPY, firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

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
  const pi = brief?.meta?.piConfidence?.headline || 'PI n/a';
  const since = brief?.meta?.sinceLastRun?.summary || '';
  const po = brief?.meta?.poReadiness || brief?.poReadiness;
  const poPill = po?.score != null
    ? `<span class="gov-global-pill">PO ${Math.round(po.score)}%</span>`
    : '';
  const deltaPill = since
    ? `<span class="gov-global-pill gov-since-delta">${escapeHtml(since.slice(0, 60))}</span>`
    : (inbox > 0 ? `<span class="gov-global-pill">Brief queue: ${inbox}</span>` : '');
  bar.innerHTML = `
    ${deltaPill}
    ${poPill}
    <span class="gov-global-pill">Gaps ${gaps}</span>
    <span class="gov-global-pill">${escapeHtml(pi.slice(0, 50))}</span>`;
  bar.hidden = false;
  document.body.classList.add('has-sub-chrome');
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
  if (!brief || document.body?.classList?.contains('governance-page')) {
    if (stickyMount) {
      stickyMount.hidden = true;
      stickyMount.innerHTML = '';
    }
    return;
  }
  const ev = brief?.executiveView || {};
  const top = brief?.topRisks?.[0] || {};
  const owner = firstNameFromDisplay(top.assigneeName || top.decisionNeededFrom) || COPY.unassigned;
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
