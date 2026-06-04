import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

let stickyMount = null;
let globalBarEl = null;

export function mountGlobalAgentBar() {
  if (globalBarEl) return globalBarEl;
  globalBarEl = document.createElement('div');
  globalBarEl.id = 'gov-global-agent-bar';
  globalBarEl.className = 'gov-global-agent-bar';
  globalBarEl.setAttribute('role', 'status');
  globalBarEl.setAttribute('aria-live', 'polite');
  globalBarEl.hidden = true;
  document.body.prepend(globalBarEl);
  return globalBarEl;
}

export function updateGlobalAgentBar(brief) {
  const bar = mountGlobalAgentBar();
  if (document.body?.classList?.contains('governance-page')) {
    bar.hidden = true;
    return;
  }
  if (!brief) {
    bar.hidden = true;
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
}

export function mountStickyMicroAnswer(mount) {
  stickyMount = mount;
  if (!mount) return;
  mount.className = 'gov-sticky-answer';
  mount.hidden = true;
  mount.setAttribute('aria-live', 'polite');
}

export function updateStickyMicroAnswer(brief) {
  if (!stickyMount) return;
  if (document.body?.classList?.contains('governance-page')) {
    stickyMount.hidden = true;
    return;
  }
  const ev = brief?.executiveView || {};
  const top = brief?.topRisks?.[0] || {};
  const line = `${ev.verdictTier || 'watch'} · ${top.assigneeName || top.decisionNeededFrom || 'owner'} · ${(brief?.meta?.setupGaps || []).length ? 'setup gap' : 'ok'}`;
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
