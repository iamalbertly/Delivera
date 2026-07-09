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
import {
  findCandidateByIndex,
  resolveJiraBoardUrl,
} from './Delivera-App-Governance-Brief-PIBaseline-02Wizard-Render-Rows-UI.js';
import {
  renderCandidates,
  renderEmpty,
  renderSlideReview,
} from './Delivera-App-Governance-Brief-PIBaseline-03Wizard-Render-Shell-UI.js';

/**
 * @param {object} ctx
 * @param {() => void} ctx.close
 * @param {() => void} [ctx.onSaved]
 * @param {(force?: boolean, opts?: object) => void|Promise<void>} ctx.open
 * @param {object} ctx.state mutable: unbindSlide, lastBodyEl, lastSlideData, lastProjects, lastCsv, lastQuarter, jiraHost, serverAiStatus
 */
export function createPiBaselineWizardActions(ctx) {
  const { state } = ctx;

  function applyReconcilePayload(bodyEl, projects, csv, quarterLabel, payload, prior) {
    const next = {
      ...prior,
      ...payload,
      extracted: prior?.extracted || payload.extracted || [],
      method: payload.method || 'slide-reconciled',
      createReceipt: prior?.createReceipt || null,
    };
    state.lastSlideData = next;
    bodyEl.innerHTML = renderSlideReview(next, csv, quarterLabel, state.jiraHost, state.serverAiStatus);
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
      bodyEl.innerHTML = renderSlideReview(data, csv, quarterLabel, state.jiraHost, state.serverAiStatus);
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    }
  }

  async function handleSlideUpload(file, bodyEl, projects, csv, quarterLabel, priorData) {
    if (!file || !bodyEl) return;
    bodyEl.innerHTML = `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineSlideReading)}</p>`;
    try {
      const data = await postSlidePropose({ file, projects, projectsCsv: csv });
      cacheSlideProposeResult(data);
      state.lastSlideData = data;
      const confirmable = (data.candidates || []).filter((c) => c.issueKey);
      if (!confirmable.length && !(data.extracted || []).length) {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        bodyEl.innerHTML = renderEmpty(data, jiraUrl, csv, quarterLabel, true);
        bindPanel(bodyEl, priorData || data, projects, csv, quarterLabel);
        return;
      }
      bodyEl.innerHTML = renderSlideReview(data, csv, quarterLabel, state.jiraHost, state.serverAiStatus);
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    } catch (err) {
      showInlineToast(bodyEl, err?.message || COPY.baselineProposeFailed, 'error');
      if (priorData?.candidates?.length) {
        bodyEl.innerHTML = renderCandidates(priorData, csv, quarterLabel, state.jiraHost, state.serverAiStatus);
        bindPanel(bodyEl, priorData, projects, csv, quarterLabel);
      }
    }
  }

  function bindPanel(el, data, projects, csv, quarterLabel) {
    state.unbindSlide?.();
    state.lastBodyEl = el;
    state.lastSlideData = data;
    state.lastProjects = projects;
    state.lastCsv = csv;
    state.lastQuarter = quarterLabel;

    el.querySelector('[data-baseline-close]')?.addEventListener('click', ctx.close);
    el.querySelector('[data-baseline-switch-sd]')?.addEventListener('click', () => {
      try { localStorage.setItem(PROJECTS_SSOT_KEY, 'SD'); } catch (_) { /* ignore */ }
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
    const dropZone = el.querySelector('#gov-baseline-slide-drop');
    if (dropZone) {
      state.unbindSlide = bindSlideDropZone(dropZone, (file) => {
        void handleSlideUpload(file, el, projects, csv, quarterLabel, data);
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
      const piName = projects.join('+') || 'MPSA+MAS';
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
        ctx.close();
        ctx.onSaved?.();
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
  };
}
