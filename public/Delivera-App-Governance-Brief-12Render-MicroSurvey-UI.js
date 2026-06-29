/**
 * Post-brief micro-survey (time saved + leader confidence).
 */
import { GOVERNANCE_SURVEY_LAST_ASKED_KEY } from './Delivera-Shared-Storage-Keys.js';

const FOUR_HOURS_MS = 4 * 3600 * 1000;

// B11: 4h timer disabled — survey now only appears post-nudge via renderPostNudgeSurvey.
function shouldShowSurvey() {
  return false;
}

function markAsked() {
  try { localStorage.setItem(GOVERNANCE_SURVEY_LAST_ASKED_KEY, new Date().toISOString()); } catch (_) {}
}

async function recordMetric(metric, value, project) {
  try {
    await fetch('/api/governance/adoption-metric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric, value, project }),
    });
  } catch (_) { /* non-blocking */ }
}

/**
 * @param {HTMLElement} mount
 * @param {string} project
 */
export function renderGovernanceMicroSurvey(mount, project = 'MPSA') {
  if (!mount || !shouldShowSurvey()) {
    if (mount) mount.innerHTML = '';
    return;
  }
  markAsked();
  mount.innerHTML = `
    <div class="gov-micro-survey" aria-label="Quick feedback">
      <p class="gov-micro-survey-label">How much reporting time did this brief save?</p>
      <div class="gov-micro-survey-row">
        <button type="button" class="gov-micro-pill" data-minutes="3">&lt;5m</button>
        <button type="button" class="gov-micro-pill" data-minutes="10">5–15m</button>
        <button type="button" class="gov-micro-pill" data-minutes="20">&gt;15m</button>
      </div>
      <p class="gov-micro-survey-label">Leader confidence in this brief (1–5)</p>
      <div class="gov-micro-survey-row gov-micro-dots" role="group">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="gov-micro-dot" data-confidence="${n}" aria-label="${n} of 5">${n}</button>`).join('')}
      </div>
    </div>`;

  const collapse = () => {
    mount.classList.add('gov-micro-survey--done');
    setTimeout(() => { mount.innerHTML = ''; }, 400);
  };

  mount.querySelectorAll('[data-minutes]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void recordMetric('reportingMinutesSaved', Number(btn.getAttribute('data-minutes')), project);
      collapse();
    });
  });
  mount.querySelectorAll('[data-confidence]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void recordMetric('leaderConfidence1to5', Number(btn.getAttribute('data-confidence')), project);
      collapse();
    });
  });
}

/**
 * B11: Post-nudge thumb chip — appears after a nudge is sent, never blocks the main view.
 * @param {HTMLElement} mount
 * @param {string} project
 */
export function renderPostNudgeSurvey(mount, project = 'MPSA') {
  if (!mount) return;
  // Don't re-show if dismissed within 24h.
  try {
    const last = localStorage.getItem('delivera:post-nudge-survey-dismissed');
    if (last && Date.now() - Number(last) < 24 * 3600 * 1000) return;
  } catch (_) { /* ignore */ }
  mount.innerHTML = `
    <div class="gov-post-nudge-survey" aria-label="Nudge feedback">
      <span class="gov-post-nudge-label">Was this nudge useful?</span>
      <button type="button" class="gov-post-nudge-thumb" data-post-nudge="up" aria-label="Yes, useful">👍</button>
      <button type="button" class="gov-post-nudge-thumb" data-post-nudge="down" aria-label="No, not useful">👎</button>
    </div>`;
  const dismiss = () => {
    try { localStorage.setItem('delivera:post-nudge-survey-dismissed', String(Date.now())); } catch (_) { /* ignore */ }
    mount.innerHTML = '';
  };
  mount.querySelectorAll('[data-post-nudge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-post-nudge') === 'up' ? 1 : 0;
      void recordMetric('nudgeUseful', value, project);
      dismiss();
    });
  });
  // Auto-dismiss after 30s if no interaction.
  setTimeout(dismiss, 30000);
}
