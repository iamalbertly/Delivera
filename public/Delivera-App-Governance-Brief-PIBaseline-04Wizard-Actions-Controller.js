/**
 * PI baseline wizard — panel bind + slide create / reconcile actions.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { aiProviderRequestHeaders } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { postSlidePropose } from './Delivera-App-Shared-PIBaseline-Slide-01Client-Helper.js';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';
import { bindSlideDropZone } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { cacheSlideProposeResult } from './Delivera-App-Shared-PIBaseline-02Slide-Outcome-Bridge-SSOT.js';
import { refreshAiTrustPill } from './Delivera-Shared-Top-Chrome-01Render-UI.js';
import {
  findCandidateByIndex,
  resolveJiraBoardUrl,
} from './Delivera-App-Governance-Brief-PIBaseline-02Wizard-Render-Rows-UI.js';
import {
  renderCandidates,
  renderEmpty,
  renderSlideReview,
  slideUploadInner,
} from './Delivera-App-Governance-Brief-PIBaseline-03Wizard-Render-Shell-UI.js';

const SLIDE_UPLOAD_OK_KEY = 'delivera_baseline_slide_ok_v1';
const AUTO_MATCH_METHODS = new Set(['slide-linked', 'slide-reconciled', 'slide-semantic-link', 'slide-board-link', 'slide-playbook', 'MATCHED']);

function markAutoSelectedCandidates(data = {}) {
  for (const c of data.candidates || []) {
    if (c.issueKey && AUTO_MATCH_METHODS.has(c.method)) c.selected = true;
  }
  return data;
}

/**
 * @param {object} ctx
 */
export function createPiBaselineWizardActions(ctx) {
  const { state } = ctx;

  function cap() {
    return state.aiCapability;
  }

  function applyReconcilePayload(bodyEl, projects, csv, quarterLabel, payload, prior) {
    const next = {
      ...prior,
      ...payload,
      extracted: prior?.extracted || payload.extracted || [],
      method: payload.method || 'slide-reconciled',
      createReceipt: prior?.createReceipt || null,
    };
    state.lastSlideData = next;
    bodyEl.innerHTML = renderSlideReview(next, csv, quarterLabel, state.jiraHost, cap());
    bindPanel(bodyEl, next, projects, csv, quarterLabel);
    const matched = Number(next.matchedCount) || (next.candidates || []).filter((c) => c.issueKey).length;
    const total = (next.resolved || []).length || matched;
    if (matched && total) {
      showInlineToast(
        bodyEl,
        COPY.baselineSlideReconciled.replace('{matched}', String(matched)).replace('{total}', String(total)),
        'success',
      );
    }
  }

  async function reconcileFromResolved(bodyEl, projects, csv, quarterLabel, data) {
    if (!Array.isArray(data?.resolved) || !data.resolved.length) return;
    const payload = await fetchJson('/api/governance/pi-baseline/reconcile-slide-epics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiProviderRequestHeaders() },
      body: JSON.stringify({
        resolved: data.resolved,
        projects,
        quarter: quarterLabel,
      }),
    }, 'pi-baseline-reconcile');
    applyReconcilePayload(bodyEl, projects, csv, quarterLabel, payload, data);
  }

  async function createEpicsBatch(bodyEl, projects, csv, quarterLabel, data, { actions = {}, createAnyway = false } = {}) {
    bodyEl.innerHTML = `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineSlideCreating)}</p>`;
    try {
      const result = await fetchJson('/api/governance/pi-baseline/create-epics-from-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiProviderRequestHeaders() },
        body: JSON.stringify({
          resolved: data.resolved || [],
          projects,
          quarter: quarterLabel,
          actions,
          createAnyway,
          includeChildStories: true,
        }),
      }, 'pi-baseline-create-epics');
      const createdN = (result.created || []).length + (result.linked || []).length;
      const failedN = (result.errors || []).length;
      const nextData = {
        ...data,
        resolved: result.resolved || data.resolved,
        ...(failedN ? { createReceipt: { created: createdN, failed: failedN } } : { createReceipt: null }),
      };
      if (result.reconcile) {
        applyReconcilePayload(bodyEl, projects, csv, quarterLabel, result.reconcile, nextData);
      } else {
        await reconcileFromResolved(bodyEl, projects, csv, quarterLabel, nextData);
      }
      if (failedN) {
        showInlineToast(
          bodyEl,
          COPY.baselineSlideCreatePartial.replace('{created}', String(createdN)).replace('{failed}', String(failedN)),
          'error',
        );
      }
    } catch (err) {
      showInlineToast(bodyEl, err?.message || COPY.baselineSlideCreateFailed, 'error');
      bodyEl.innerHTML = renderSlideReview(data, csv, quarterLabel, state.jiraHost, cap());
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    }
  }

  async function restoreAfterUploadError(bodyEl, priorData, projects, csv, quarterLabel, err) {
    const code = err?.code ? ` (${err.code})` : '';
    const msg = `${err?.message || COPY.baselineProposeFailed}${code}`;
    const jiraUrl = await resolveJiraBoardUrl(projects);
    if (priorData?.candidates?.length) {
      bodyEl.innerHTML = renderCandidates(priorData, csv, quarterLabel, state.jiraHost, cap());
    } else {
      bodyEl.innerHTML = renderEmpty(priorData || {}, jiraUrl, csv, quarterLabel, true, msg, cap());
    }
    bindPanel(bodyEl, priorData || { candidates: [] }, projects, csv, quarterLabel);
    showInlineToast(bodyEl, msg, 'error');
  }

  async function handleSlideUpload(file, bodyEl, projects, csv, quarterLabel, priorData, { refresh = false } = {}) {
    if (!file || !bodyEl) return;
    state.lastSlideFile = file;
    // Progressive feedback with elapsed time + cancel (Edge 2 — no silent 60s wait)
    const startTime = Date.now();
    let progressEl = bodyEl.querySelector('[data-testid="gov-baseline-slide-progress"]');
    if (!progressEl) {
      bodyEl.innerHTML = `<p class="gov-baseline-loading" aria-busy="true" data-testid="gov-baseline-slide-progress">${escapeHtml(COPY.baselineSlideReading)}<br><span class="gov-baseline-loading-sub">${escapeHtml(COPY.baselineSlideProgressRead)} → ${escapeHtml(COPY.baselineSlideProgressExtract)} → ${escapeHtml(COPY.baselineSlideProgressMatch)}</span><br><span class="gov-baseline-loading-sub">${escapeHtml(COPY.aiSlideReadingSub)}</span><br><span class="gov-baseline-slide-elapsed" data-slide-elapsed>0s</span> <button type="button" class="btn btn-link btn-compact" data-slide-cancel>Cancel</button></p>`;
      progressEl = bodyEl.querySelector('[data-testid="gov-baseline-slide-progress"]');
    }
    const elapsedEl = progressEl?.querySelector('[data-slide-elapsed]');
    const cancelBtn = progressEl?.querySelector('[data-slide-cancel]');
    const elapsedTimer = elapsedEl ? setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      if (elapsedEl) elapsedEl.textContent = secs + 's';
      // Progressive messages at 30s and 45s
      if (secs === 30 && elapsedEl) {
        elapsedEl.parentElement?.querySelector('.gov-baseline-loading-sub:last-of-type')?.insertAdjacentHTML('afterend', `<br><span class="gov-baseline-loading-sub">Still working — large images take longer</span>`);
      }
      if (secs === 45 && elapsedEl) {
        elapsedEl.parentElement?.querySelector('.gov-baseline-loading-sub:last-of-type')?.insertAdjacentHTML('afterend', `<br><span class="gov-baseline-loading-sub">Almost there — or cancel and retry with a smaller image</span>`);
      }
    }, 1000) : null;
    // Client-side AbortController (Edge 2 — server already has it)
    const abortController = new AbortController();
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      abortController.abort();
      if (elapsedTimer) clearInterval(elapsedTimer);
      restoreAfterUploadError(bodyEl, priorData, projects, csv, quarterLabel, { message: 'Upload cancelled', code: 'CANCELLED' });
    });
    try {
      const data = markAutoSelectedCandidates(await postSlidePropose({ file, projects, projectsCsv: csv, signal: abortController.signal, refresh }));
      if (elapsedTimer) clearInterval(elapsedTimer);
      cacheSlideProposeResult(data);
      state.lastSlideData = data;
      try { sessionStorage.setItem(SLIDE_UPLOAD_OK_KEY, '1'); } catch (_) { /* ignore */ }
      void refreshAiTrustPill();
      const confirmable = (data.candidates || []).filter((c) => c.issueKey);
      if (!confirmable.length && !(data.extracted || []).length) {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        // Resolve the SPECIFIC failure reason instead of a generic message.
        const failHint = resolveSlideFailReason(data, cap());
        bodyEl.innerHTML = renderEmpty(data, jiraUrl, csv, quarterLabel, true, failHint.text, cap());
        // Inject actionable CTAs (Add AI key / Retry / Open settings) inline.
        const ctaMount = bodyEl.querySelector('[data-testid="gov-baseline-slide-fail-cta"]') || bodyEl.querySelector('.gov-baseline-empty-hint');
        if (ctaMount && failHint.cta) {
          const cta = document.createElement('div');
          cta.className = 'gov-baseline-slide-fail-cta';
          cta.setAttribute('data-testid', 'gov-baseline-slide-fail-cta');
          cta.innerHTML = failHint.cta;
          ctaMount.after(cta);
          cta.querySelector('[data-slide-retry]')?.addEventListener('click', () => {
            const input = bodyEl.querySelector('#gov-baseline-slide-input');
            if (input) input.click();
          });
          cta.querySelector('[data-slide-open-settings]')?.addEventListener('click', () => {
            window.location.href = '/settings#ai-provider';
          });
        }
        bindPanel(bodyEl, priorData || data, projects, csv, quarterLabel);
        return;
      }
      if (Array.isArray(data.resolved) && data.resolved.length) {
        await reconcileFromResolved(bodyEl, projects, csv, quarterLabel, data);
        return;
      }
      bodyEl.innerHTML = renderSlideReview(data, csv, quarterLabel, state.jiraHost, cap());
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    } catch (err) {
      void refreshAiTrustPill();
      await restoreAfterUploadError(bodyEl, priorData, projects, csv, quarterLabel, err);
    }
  }

  /**
   * Resolve the specific reason a slide upload returned no commitments.
   * Returns { text, cta } where cta is an HTML string with inline actions.
   * Edge cases: (a) no AI key, (b) AI timeout, (c) no readable text,
   * (d) quota exceeded, (e) squad mismatch, (f) generic fallback.
   */
  function resolveSlideFailReason(data, capability) {
    const meta = data?.extractionMeta || {};
    const guidance = String(data?.guidance || '').toLowerCase();
    const slideVisionReady = Boolean(capability?.slideVisionReady);
    // (a) No AI key configured.
    if (!slideVisionReady || meta.fallbackUsed === true && /check ai key/i.test(guidance)) {
      return {
        text: COPY.baselineSlideFailNoKey,
        cta: `<button type="button" class="btn btn-primary btn-compact" data-slide-open-settings>${escapeHtml(COPY.baselineSlideFailNoKeyCta)}</button> <button type="button" class="btn btn-secondary btn-compact" data-slide-retry>${escapeHtml(COPY.baselineSlideFailCtaRetry)}</button>`,
      };
    }
    // (b) AI timeout.
    if (/timeout|timed out/i.test(guidance)) {
      return {
        text: COPY.baselineSlideFailTimeout,
        cta: `<button type="button" class="btn btn-primary btn-compact" data-slide-retry>${escapeHtml(COPY.baselineSlideFailCtaRetry)}</button>`,
      };
    }
    // (c) No readable text.
    if (/no text|no readable|unreadable/i.test(guidance) || (meta.parseError && /json|parse/i.test(meta.parseError))) {
      return {
        text: COPY.baselineSlideFailNoText,
        cta: `<button type="button" class="btn btn-primary btn-compact" data-slide-retry>${escapeHtml(COPY.baselineSlideFailCtaRetry)}</button>`,
      };
    }
    // (d) Quota exceeded.
    if (/quota|rate limit|429/i.test(guidance)) {
      return {
        text: COPY.baselineSlideFailQuota,
        cta: `<button type="button" class="btn btn-secondary btn-compact" data-slide-open-settings>${escapeHtml(COPY.baselineSlideFailCtaSettings)}</button>`,
      };
    }
    // (f) Generic fallback — still actionable with retry + settings.
    return {
      text: COPY.baselineSlideFailGeneric,
      cta: `<button type="button" class="btn btn-primary btn-compact" data-slide-retry>${escapeHtml(COPY.baselineSlideFailCtaRetry)}</button> <button type="button" class="btn btn-link btn-compact" data-slide-open-settings>${escapeHtml(COPY.baselineSlideFailCtaSettings)}</button>`,
    };
  }

  function patchSlideUpload(el, data, projects, csv, quarterLabel) {
    const details = el.querySelector('.gov-baseline-optional');
    if (!details) return;
    const oldHint = details.querySelector('.gov-baseline-ai-hint');
    oldHint?.remove();
    const oldDrop = details.querySelector('.gov-baseline-slide-drop');
    const wrap = document.createElement('div');
    wrap.innerHTML = slideUploadInner(cap());
    const newDrop = wrap.querySelector('.gov-baseline-slide-drop');
    const newHint = wrap.querySelector('.gov-baseline-ai-hint');
    if (oldDrop && newDrop) oldDrop.replaceWith(newDrop);
    if (newHint) details.appendChild(newHint);
    state.unbindSlide?.();
    const dropZone = el.querySelector('#gov-baseline-slide-drop');
    if (dropZone && cap()?.slideVisionReady) {
      state.unbindSlide = bindSlideDropZone(dropZone, (file) => {
        void handleSlideUpload(file, el, projects, csv, quarterLabel, data);
      });
    }
  }

  function bindPanel(el, data, projects, csv, quarterLabel) {
    state.unbindSlide?.();
    state.lastBodyEl = el;
    state.lastSlideData = data;
    state.lastPanelData = data;
    state.lastProjects = projects;
    state.lastCsv = csv;
    state.lastQuarter = quarterLabel;

    el.querySelector('[data-baseline-close]')?.addEventListener('click', () => {
      const matched = (data.candidates || []).filter((c) => c.issueKey).length;
      if (matched > 0 && !data._baselineSaved) {
        const save = window.confirm(`You have ${matched} matched epic${matched === 1 ? '' : 's'} ready to save. Close without saving?`);
        if (!save) return;
      }
      ctx.close();
    });
    el.querySelector('[data-baseline-switch-sd]')?.addEventListener('click', () => {
      try { localStorage.setItem(PROJECTS_SSOT_KEY, 'SD'); } catch (_) { /* ignore */ }
      ctx.close();
      window.location.reload();
    });
    el.querySelector('[data-baseline-switch-quarter]')?.addEventListener('click', (ev) => {
      const q = ev.currentTarget?.getAttribute('data-baseline-switch-quarter') || '';
      if (!q) return;
      try { localStorage.setItem('delivera_gov_quarter_v1', q); } catch (_) { /* ignore */ }
      ctx.close();
      window.location.reload();
    });
    el.querySelector('#gov-baseline-refresh')?.addEventListener('click', () => {
      ctx.close();
      ctx.onSaved?.();
      ctx.open(true);
    });
    el.querySelector('#gov-baseline-refresh-list')?.addEventListener('click', () => {
      ctx.close();
      ctx.open(true);
    });
    el.querySelector('[data-slide-refresh-match]')?.addEventListener('click', async () => {
      if (state.lastSlideFile) {
        void handleSlideUpload(state.lastSlideFile, el, projects, csv, quarterLabel, data, { refresh: true });
        return;
      }
      if (Array.isArray(data?.resolved) && data.resolved.length) {
        el.innerHTML = `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineSlideMatching)}</p>`;
        await reconcileFromResolved(el, projects, csv, quarterLabel, data);
      }
    });
    const dropZone = el.querySelector('#gov-baseline-slide-drop');
    if (dropZone && cap()?.slideVisionReady) {
      state.unbindSlide = bindSlideDropZone(dropZone, (file) => {
        const input = dropZone.querySelector('#gov-baseline-slide-input');
        void handleSlideUpload(file, el, projects, csv, quarterLabel, data).finally(() => {
          if (input) input.value = '';
        });
      });
    }

    el.querySelector('#gov-baseline-create-all')?.addEventListener('click', () => {
      const actions = {};
      for (const row of (data.resolved || [])) {
        if (row.status === 'missing') actions[row.suggestedEpicTitle] = 'create';
      }
      void createEpicsBatch(el, projects, csv, quarterLabel, data, { actions, createAnyway: false });
    });

    el.querySelectorAll('[data-baseline-use-existing]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const title = btn.getAttribute('data-epic-title') || '';
        const key = btn.getAttribute('data-issue-key') || '';
        if (!title || !key) return;
        void createEpicsBatch(el, projects, csv, quarterLabel, data, {
          actions: { [title]: 'link' },
        });
      });
    });

    el.querySelectorAll('[data-baseline-create-one]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const title = btn.getAttribute('data-epic-title') || '';
        if (!title) return;
        void createEpicsBatch(el, projects, csv, quarterLabel, data, {
          actions: { [title]: 'create' },
          createAnyway: true,
        });
      });
    });

    el.querySelector('#gov-baseline-confirm')?.addEventListener('click', async () => {
      const checked = [...el.querySelectorAll('[data-candidate]:checked:not([disabled])')];
      const pool = data._confirmable || data.candidates || [];
      const items = checked.map((inp) => {
        const idx = inp.getAttribute('data-candidate');
        let c = null;
        if (String(idx).startsWith('u-')) {
          c = findCandidateByIndex(data, idx);
        } else {
          c = pool[Number(idx)] || pool.find((_, i) => String(i) === idx);
        }
        if (!c) return null;
        const act = c.epicActivity;
        return {
          issueKey: c.issueKey,
          title: c.title || c.suggestedEpicTitle,
          squad: c.squad || projects[0],
          ...(c.targetDate ? { targetDate: c.targetDate } : {}),
          ...(act ? {
            epicActivity: {
              lifecycle: act.lifecycle,
              sprintCount: act.sprintCount,
              firstActiveSprintStart: act.firstActiveSprintStart,
              storyCount: act.storyCount,
              doneCount: act.doneCount,
            },
          } : {}),
        };
      }).filter((i) => i?.issueKey);
      if (!items.length) {
        showInlineToast(el, 'Select at least one promised work item.', 'error');
        const first = el.querySelector('[data-candidate]:not([disabled])');
        first?.focus?.();
        return;
      }
      const piName = quarterLabel
        ? `${projects.join('+')}:${quarterLabel.replace(/\s+/g, ' ').trim()}`
        : (projects.join('+') || 'MPSA+MAS');
      try {
        await fetchJson('/api/governance/pi-baseline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            piName,
            projects,
            source: data.method,
            committedItems: items,
            approvedBy: 'governance-wizard',
          }),
        }, 'pi-baseline-save');
        data._baselineSaved = true;
        ctx.close();
        ctx.onSaved?.();
        document.querySelector('[data-testid="governance-commitment-above-fold"], .gov-priority-commitment-rail')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        showInlineToast(el, err?.message || COPY.baselineSaveFailed, 'error');
      }
    });
  }

  return {
    bindPanel,
    handleSlideUpload,
    createEpicsBatch,
    reconcileFromResolved,
    applyReconcilePayload,
    patchSlideUpload,
  };
}
