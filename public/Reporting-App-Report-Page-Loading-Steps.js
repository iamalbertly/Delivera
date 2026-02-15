import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { LOADING_STEP_LIMIT } from './Reporting-App-Report-Config-Constants.js';

const LOADING_CHIP_MIN_VISIBLE_MS = 300;
// Length must match LOADING_STAGE_PERCENT; used for progress bar and aria
const LOADING_STAGES = [
  'Loading data from Jira…',
  'Processing metrics…',
  'Rendering report…',
];
const LOADING_STAGE_PERCENT = [15, 60, 100];
// Theater: fast ramp 40→65% in 2.5s so cache/fast responses feel instant; then hold at 65% for long runs
const THEATER_FILL_START = 40;
const THEATER_FILL_CAP = 65;
const THEATER_FAST_RAMP_MS = 2500;
const THEATER_SUB_MESSAGE_INTERVAL_MS = 1200;
const THEATER_STEP_CUE_MS = 800;
const GATHERING_SUB_MESSAGES = ['Loading boards…', 'Loading sprints…', 'Loading work items…'];
let loadingChipShowTimerId = null;
let theaterFillIntervalId = null;
let theaterMessageIntervalId = null;
let theaterStepCueIntervalId = null;

function clearLoadingChipShowTimer() {
  if (loadingChipShowTimerId != null) {
    clearTimeout(loadingChipShowTimerId);
    loadingChipShowTimerId = null;
  }
}

export function updateLoadingMessage(message, step = null) {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
  const chip = document.getElementById('loading-status-chip');
  if (chip && chip.style.display !== 'none') {
    chip.textContent = message;
  }
  if (step) {
    appendLoadingStep(step);
  }
}

function applyLoadingHintForComplexity(complexityLevel) {
  const hintEl = document.querySelector('.loading-hint');
  if (!hintEl) return;
  if (!complexityLevel) {
    hintEl.textContent = 'Usually ready in under 30s for one quarter.';
    return;
  }
  if (complexityLevel === 'light') {
    hintEl.textContent = 'Usually ready in under 30s for one quarter.';
  } else if (complexityLevel === 'medium') {
    hintEl.textContent = 'Wider range — expect 30-60s. Recent data loads first.';
  } else {
    // heavy or veryHeavy
    hintEl.textContent = 'Large query — 60-90s. Latest 2 weeks load first, then history.';
  }
}

export function stopTheaterGathering() {
  if (theaterFillIntervalId != null) {
    clearInterval(theaterFillIntervalId);
    theaterFillIntervalId = null;
  }
  if (theaterMessageIntervalId != null) {
    clearInterval(theaterMessageIntervalId);
    theaterMessageIntervalId = null;
  }
  if (theaterStepCueIntervalId != null) {
    clearInterval(theaterStepCueIntervalId);
    theaterStepCueIntervalId = null;
  }
  const stepCueEl = document.getElementById('loading-step-cue');
  if (stepCueEl) stepCueEl.textContent = '';
}

/** On abort/timeout, reset progress bar so we do not leave it stuck at theater cap. */
export function resetLoadingBarToZero() {
  const fillEl = document.getElementById('loading-progress-fill');
  const barEl = document.querySelector('.loading-progress-bar[role="progressbar"]');
  if (fillEl) fillEl.style.width = '0%';
  if (barEl) {
    barEl.setAttribute('aria-valuenow', 0);
    barEl.setAttribute('aria-label', 'Report loading progress');
  }
  const stepCueEl = document.getElementById('loading-step-cue');
  if (stepCueEl) stepCueEl.textContent = '';
}

export function startTheaterGathering(getElapsedMs) {
  stopTheaterGathering();
  const fillEl = document.getElementById('loading-progress-fill');
  const barEl = document.querySelector('.loading-progress-bar[role="progressbar"]');
  const msgEl = document.getElementById('loading-message');
  const stepCueEl = document.getElementById('loading-step-cue');
  let subIndex = 0;

  theaterFillIntervalId = setInterval(() => {
    const elapsed = typeof getElapsedMs === 'function' ? getElapsedMs() : 0;
    const pct = elapsed < THEATER_FAST_RAMP_MS
      ? THEATER_FILL_START + (elapsed / THEATER_FAST_RAMP_MS) * (THEATER_FILL_CAP - THEATER_FILL_START)
      : THEATER_FILL_CAP;
    if (fillEl) fillEl.style.width = `${Math.min(100, pct)}%`;
    if (barEl) {
      barEl.setAttribute('aria-valuenow', Math.round(pct));
      barEl.setAttribute('aria-label', 'Report loading progress');
    }
  }, 100);

  function updateTheaterMessage() {
    const elapsed = typeof getElapsedMs === 'function' ? getElapsedMs() : 0;
    const sec = Math.floor(elapsed / 1000);
    const timeStr = sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
    const sub = GATHERING_SUB_MESSAGES[subIndex % GATHERING_SUB_MESSAGES.length];
    const text = `${sub} (${timeStr})`;
    if (msgEl) msgEl.textContent = text;
    const chip = document.getElementById('loading-status-chip');
    if (chip && chip.style.display !== 'none') chip.textContent = text;
    subIndex += 1;
  }
  updateTheaterMessage();
  theaterMessageIntervalId = setInterval(updateTheaterMessage, THEATER_SUB_MESSAGE_INTERVAL_MS);

  function updateStepCue() {
    if (!stepCueEl) return;
    const elapsed = typeof getElapsedMs === 'function' ? getElapsedMs() : 0;
    const sec = Math.floor(elapsed / 1000);
    if (sec > 5) stepCueEl.textContent = sec + 's elapsed';
    else stepCueEl.textContent = '';
  }
  updateStepCue();
  theaterStepCueIntervalId = setInterval(updateStepCue, 200);
}

export function setLoadingStage(stageIndex, label, complexityLevel) {
  if (stageIndex === 1) stopTheaterGathering();
  const msgEl = document.getElementById('loading-message');
  if (msgEl) msgEl.textContent = label != null ? label : (LOADING_STAGES[stageIndex] || 'Loading…');
  const fillEl = document.getElementById('loading-progress-fill');
  const barEl = document.querySelector('.loading-progress-bar[role="progressbar"]');
  const pct = Math.min(100, Math.max(0, LOADING_STAGE_PERCENT[stageIndex] ?? (stageIndex * 25)));
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (barEl) {
    barEl.setAttribute('aria-valuenow', pct);
    barEl.setAttribute('aria-label', label != null ? label : (LOADING_STAGES[stageIndex] || 'Report loading progress'));
  }
  const stepCueEl = document.getElementById('loading-step-cue');
  if (stepCueEl) stepCueEl.textContent = '';
  const chip = document.getElementById('loading-status-chip');
  if (chip && chip.style.display !== 'none') chip.textContent = msgEl ? msgEl.textContent : '';
  if (typeof complexityLevel === 'string') {
    applyLoadingHintForComplexity(complexityLevel);
  }
}

export function clearLoadingSteps() {
  const loadingSteps = document.getElementById('loading-steps');
  if (loadingSteps) {
    loadingSteps.innerHTML = '';
  }
}

export function appendLoadingStep(step) {
  const loadingSteps = document.getElementById('loading-steps');
  if (!loadingSteps) return;

  const stepEl = document.createElement('div');
  stepEl.className = 'loading-step';
  stepEl.textContent = step;
  loadingSteps.appendChild(stepEl);

  const items = loadingSteps.querySelectorAll('.loading-step');
  if (items.length > LOADING_STEP_LIMIT) {
    for (let i = 0; i < items.length - LOADING_STEP_LIMIT; i++) {
      loadingSteps.removeChild(items[i]);
    }
  }
}

export function scheduleRender(work) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => work(), { timeout: 1000 });
  } else {
    setTimeout(work, 0);
  }
}

export async function readResponseJson(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return { data: await response.json(), text: null };
    } catch (_) {
      const text = await response.text().catch(() => '');
      return { data: null, text };
    }
  }

  const text = await response.text().catch(() => '');
  return { data: null, text };
}

export function setLoadingVisible(visible = true) {
  const { loadingEl } = reportDom;
  if (!loadingEl) return;
  const chip = document.getElementById('loading-status-chip');
  const previewArea = document.querySelector('.preview-area');
  const loadLatestWrap = document.getElementById('report-load-latest-wrap');
  if (visible) {
    loadingEl.style.display = 'block';
    loadingEl.setAttribute('aria-hidden', 'false');
    if (previewArea) previewArea.setAttribute('aria-busy', 'true');
    if (loadLatestWrap) loadLatestWrap.style.display = 'none';
    clearLoadingChipShowTimer();
    loadingChipShowTimerId = setTimeout(() => {
      loadingChipShowTimerId = null;
      if (chip) {
        chip.style.display = 'block';
        const msgEl = document.getElementById('loading-message');
        if (msgEl) chip.textContent = msgEl.textContent || '';
      }
    }, LOADING_CHIP_MIN_VISIBLE_MS);
  } else {
    clearLoadingChipShowTimer();
    loadingEl.style.display = 'none';
    loadingEl.setAttribute('aria-hidden', 'true');
    if (previewArea) previewArea.setAttribute('aria-busy', 'false');
    if (chip) {
      chip.style.display = 'none';
      chip.textContent = '';
    }
  }
}

export function hideLoadingIfVisible() {
  clearLoadingChipShowTimer();
  stopTheaterGathering();
  const { loadingEl } = reportDom;
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.setAttribute('aria-hidden', 'true');
  }
  const previewArea = document.querySelector('.preview-area');
  if (previewArea) previewArea.setAttribute('aria-busy', 'false');
  const chip = document.getElementById('loading-status-chip');
  if (chip) {
    chip.style.display = 'none';
    chip.textContent = '';
  }
}

export function forceHideLoading() {
  clearLoadingChipShowTimer();
  stopTheaterGathering();
  const { loadingEl } = reportDom;
  try {
    if (loadingEl) {
      loadingEl.style.display = 'none';
      loadingEl.setAttribute('aria-hidden', 'true');
      const steps = loadingEl.querySelectorAll('.loading-step');
      if (steps && steps.length) {
        loadingEl.querySelector('.loading-steps').innerHTML = '';
      }
    }
  } catch (e) {
    // best-effort, ignore
  }
  try {
    const previewArea = document.querySelector('.preview-area');
    if (previewArea) previewArea.setAttribute('aria-busy', 'false');
    const chip = document.getElementById('loading-status-chip');
    if (chip) {
      chip.style.display = 'none';
      chip.textContent = '';
    }
  } catch (_) {}
}
