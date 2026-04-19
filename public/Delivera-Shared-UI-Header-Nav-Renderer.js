/* Shared Header Renderer
 * Ensures consistent header layout and wires feedback FAB and toggle into header.
 */
import { initFeedbackPanel } from './Reporting-App-Report-UI-Feedback.js';
import { getContextDisplayString, getLastMetaFreshnessInfo } from './Reporting-App-Shared-Context-From-Storage.js';
import { REPORT_LAST_META_KEY } from './Reporting-App-Shared-Storage-Keys.js';

function getContextStateBadge() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(REPORT_LAST_META_KEY);
    if (!raw || !raw.trim()) return null;
    const meta = JSON.parse(raw);
    const isPartial = meta?.partial === true;
    const isClosest = meta?.reducedScope === true;
    const isCached = meta?.fromCache === true && !isPartial && !isClosest;
    const isLive = !isCached && !isPartial && !isClosest;
    if (isPartial) return { label: 'Partial', kind: 'partial' };
    if (isClosest) return { label: 'Closest', kind: 'closest' };
    if (isCached) return { label: 'Cached', kind: 'cached' };
    if (isLive) return { label: 'Live', kind: 'live' };
    return null;
  } catch (_) {
    return null;
  }
}

export function ensureSharedHeader() {
  try {
    // Ensure header has expected structure and classes
    const header = document.querySelector('header');
    if (!header) return;

    header.classList.add('app-header');

    const path = (() => {
      try {
        return window.location && window.location.pathname ? window.location.pathname : '';
      } catch (_) {
        return '';
      }
    })();
    const suppressContextBar = path === '/report'
      || path.endsWith('/report')
      || path === '/current-sprint'
      || path.endsWith('/current-sprint');

    // Context bar: keep only on pages that do not already have a dedicated context strip/card.
    let contextBar = header.querySelector('.shared-context-bar[data-context-bar]');
    if (suppressContextBar) {
      contextBar?.remove();
    } else if (!contextBar) {
      contextBar = document.createElement('div');
      contextBar.setAttribute('data-context-bar', 'true');
      contextBar.className = 'subtitle shared-context-bar';
      contextBar.style.cssText = 'margin: 0.35rem 0 0; font-size: 0.9rem; font-weight: 600;';
      const row = header.querySelector('.header-row');
      if (row) row.after(contextBar);
      else header.appendChild(contextBar);
    }
    if (contextBar) {
      const contextText = getContextDisplayString();
      const state = getContextStateBadge();
      const freshnessInfo = getLastMetaFreshnessInfo();
      contextBar.innerHTML = '';
      const textSpan = document.createElement('span');
      textSpan.className = 'shared-context-bar-text';
      textSpan.textContent = contextText;
      contextBar.appendChild(textSpan);
      if (state) {
        const badge = document.createElement('span');
        badge.setAttribute('data-context-state-badge', 'true');
        badge.className = 'context-state-badge context-state-badge--' + state.kind;
        badge.textContent = ` ${state.label}`;
        contextBar.appendChild(badge);
      }
      attachStaleHint(contextBar, freshnessInfo);
    }

    /**
     * Call after persisting last query (e.g. after successful preview) to update the bar without reload.
     */
    function attachStaleHint(container, info) {
      if (!info || !info.isStale) return;
      const hint = document.createElement('button');
      hint.type = 'button';
      hint.className = 'context-stale-hint';
      hint.textContent = 'Context may be stale - click to refresh';
      hint.addEventListener('click', () => {
        try {
          const path = window.location && window.location.pathname;
          if (path === '/report' || (path || '').endsWith('/report')) {
            const previewBtn = document.getElementById('preview-btn');
            if (previewBtn && !previewBtn.disabled) previewBtn.click();
          } else if (path === '/current-sprint' || (path || '').endsWith('/current-sprint')) {
            document.dispatchEvent(new Event('refreshSprint'));
          }
        } catch (_) {}
      });
      container.appendChild(hint);
    }

    window.__refreshReportingContextBar = function refreshContextBar() {
      const headerEl = document.querySelector('header');
      if (!headerEl) return;
      const bar = headerEl.querySelector('.shared-context-bar[data-context-bar]');
      if (!bar || suppressContextBar) return;
      const text = getContextDisplayString();
      const state = getContextStateBadge();
      const info = getLastMetaFreshnessInfo();
      bar.innerHTML = '';
      const textSpanInner = document.createElement('span');
      textSpanInner.className = 'shared-context-bar-text';
      textSpanInner.textContent = text;
      bar.appendChild(textSpanInner);
      if (state) {
        const badgeInner = document.createElement('span');
        badgeInner.setAttribute('data-context-state-badge', 'true');
        badgeInner.className = 'context-state-badge context-state-badge--' + state.kind;
        badgeInner.textContent = ` ${state.label}`;
        bar.appendChild(badgeInner);
      }
      attachStaleHint(bar, info);
    };

    document.getElementById('feedback-corner')?.remove();
    initFeedbackPanel();

    // Mark header as unified for styling hooks
    header.setAttribute('data-shared-header', 'true');
  } catch (e) {
    // ignore; header enhancements are progressive
  }
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSharedHeader);
} else {
  ensureSharedHeader();
}
