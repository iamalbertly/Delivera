/**
 * Post-brief micro-survey (time saved + leader confidence).
 */
import { GOVERNANCE_SURVEY_LAST_ASKED_KEY } from './Delivera-Shared-Storage-Keys.js';

const FOUR_HOURS_MS = 4 * 3600 * 1000;

function shouldShowSurvey() {
  try {
    const raw = localStorage.getItem(GOVERNANCE_SURVEY_LAST_ASKED_KEY);
    if (!raw) return true;
    return Date.now() - new Date(raw).getTime() > FOUR_HOURS_MS;
  } catch (_) {
    return true;
  }
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
