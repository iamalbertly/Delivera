/**
 * SSOT: Global "Improve Delivera" feedback modal (all surfaces).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { getContextDisplayString } from './Delivera-Shared-Context-From-Storage.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { getCurrentPageForChrome } from './Delivera-Shared-Top-Chrome-01Render-UI.js';
import { showSprintActionToast } from './Delivera-CurrentSprint-Action-Bridge.js';

const CATEGORIES = ['Missing data', 'Confusing', 'Too slow', 'Wrong answer', 'Other'];

function ensureModal() {
  let el = document.getElementById('delivera-improve-modal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'delivera-improve-modal';
  el.className = 'delivera-improve-modal';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'delivera-improve-title');
  document.body.appendChild(el);
  return el;
}

function resolveSquadContext() {
  const fromStorage = readSharedProjectsCsv?.() || '';
  if (fromStorage) return fromStorage;
  const scopeChips = Array.from(document.querySelectorAll('#gov-scope-bar-mount .gov-scope-chip.is-on[data-project]'))
    .map((el) => el.getAttribute('data-project') || '')
    .filter(Boolean);
  if (scopeChips.length) return scopeChips.join(',');
  return getContextDisplayString();
}

function buildContext(includeContext) {
  if (!includeContext) return null;
  const page = getCurrentPageForChrome();
  const squad = resolveSquadContext();
  const jump = document.getElementById('issue-jump-input');
  const issueKey = jump?.value?.trim() || '';
  return { page, squad, issueKey: issueKey || undefined };
}

function renderModal(el) {
  const chips = CATEGORIES.map((c) => (
    `<button type="button" class="delivera-improve-chip" data-improve-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  )).join('');
  el.innerHTML = ''
    + '<div class="delivera-improve-backdrop" data-improve-close tabindex="-1"></div>'
    + '<div class="delivera-improve-panel">'
    + `<h2 id="delivera-improve-title">${escapeHtml(COPY.improveDelivera)}</h2>`
    + `<p class="delivera-improve-sub">Help us improve Delivera for your team.</p>`
    + `<label class="delivera-improve-label" for="delivera-improve-message">${escapeHtml(COPY.improveDeliveraPlaceholder)}</label>`
    + `<textarea id="delivera-improve-message" class="delivera-improve-textarea" rows="4" maxlength="500" required></textarea>`
    + `<div class="delivera-improve-chips" role="group" aria-label="Category">${chips}</div>`
    + '<label class="delivera-improve-check"><input type="checkbox" id="delivera-improve-context" checked> Include page context</label>'
    + '<p class="delivera-improve-status" id="delivera-improve-status" aria-live="polite"></p>'
    + '<div class="delivera-improve-actions">'
    + `<button type="button" class="btn btn-secondary btn-compact" data-improve-close>${escapeHtml(COPY.close)}</button>`
    + '<button type="button" class="btn btn-primary btn-compact" id="delivera-improve-submit">Send</button>'
    + '</div></div>';
}

function closeModal(el) {
  el.hidden = true;
  document.body.classList.remove('delivera-improve-open');
}

export function openImproveDeliveraModal() {
  const el = ensureModal();
  renderModal(el);
  el.hidden = false;
  document.body.classList.add('delivera-improve-open');
  let selectedCategory = '';
  el.querySelectorAll('[data-improve-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.getAttribute('data-improve-category') || '';
      el.querySelectorAll('[data-improve-category]').forEach((b) => b.classList.toggle('is-on', b === btn));
    });
  });
  el.querySelectorAll('[data-improve-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(el));
  });
  el.querySelector('#delivera-improve-submit')?.addEventListener('click', async () => {
    const messageEl = el.querySelector('#delivera-improve-message');
    const statusEl = el.querySelector('#delivera-improve-status');
    const includeContext = el.querySelector('#delivera-improve-context')?.checked !== false;
    const message = String(messageEl?.value || '').trim();
    if (!message) {
      if (statusEl) statusEl.textContent = 'Please enter your feedback.';
      return;
    }
    const submitBtn = el.querySelector('#delivera-improve-submit');
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Sending…';
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          category: selectedCategory || undefined,
          context: buildContext(includeContext),
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed'));
      if (statusEl) statusEl.textContent = COPY.feedbackReceived;
      showSprintActionToast(COPY.feedbackReceived, 'success');
      if (messageEl) messageEl.value = '';
      try { localStorage.setItem('feedback-last-sent', String(Date.now())); } catch (_) {}
      window.setTimeout(() => closeModal(el), 600);
    } catch (err) {
      if (statusEl) statusEl.textContent = `Failed: ${err.message || 'try again'}`;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
  el.querySelector('#delivera-improve-message')?.focus();
}
