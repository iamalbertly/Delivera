import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

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
  if (!brief) {
    bar.hidden = true;
    return;
  }
  const receipt = brief?.meta?.workerReceipt || {};
  const inbox = receipt.inboxTotal ?? receipt.pendingCount ?? 0;
  const gaps = (brief?.meta?.setupGaps || []).length;
  const pi = brief?.meta?.piConfidence?.headline || 'PI n/a';
  bar.innerHTML = `
    <span class="gov-global-pill">${escapeHtml(commandAnswerSentence(brief).slice(0, 80))}</span>
    <span class="gov-global-pill">Queue ${inbox}</span>
    <span class="gov-global-pill">Gaps ${gaps}</span>
    <span class="gov-global-pill">${escapeHtml(pi)}</span>`;
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
  const line = commandAnswerSentence(brief);
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
