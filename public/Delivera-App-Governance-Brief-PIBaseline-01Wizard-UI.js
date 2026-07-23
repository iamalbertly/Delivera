/**
 * PI baseline propose + confirm wizard (right drawer).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { aiProviderRequestHeaders, fetchAiProviderStatus } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { postSlidePropose, readGovernanceQuarter } from './Delivera-App-Shared-PIBaseline-Slide-01Client-Helper.js';
import { bindSlideDropZone } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  baselineDrawerTitle,
  renderBaselineCandidates,
  renderBaselineEmpty,
  renderBaselineLoading,
  renderBaselineSlideReview,
} from './Delivera-App-Governance-PIBaseline-Wizard-02Render-UI.js';

let cachedJiraBrowseHost = null;

async function resolveJiraBrowseHost(projects) {
  if (cachedJiraBrowseHost) return cachedJiraBrowseHost;
  const csv = (projects || []).join(',') || 'MPSA';
  try {
    const data = await fetchJson(`/api/boards.json?projects=${encodeURIComponent(csv)}`, {}, 'baseline-boards');
    cachedJiraBrowseHost = data?.jiraBrowseHost || null;
  } catch (_) {
    cachedJiraBrowseHost = null;
  }
  return cachedJiraBrowseHost;
}

async function resolveJiraBoardUrl(projects) {
  const host = await resolveJiraBrowseHost(projects);
  const key = projects[0];
  if (host && key) return `${host}/browse/${key}`;
  return null;
}

/**
 * @param {object} opts
 * @param {() => string} opts.getProjectsCsv
 * @param {() => string} [opts.getQuarterLabel]
 * @param {() => void} [opts.onSaved]
 */
export function mountPIBaselineWizard({ getProjectsCsv, getQuarterLabel, onSaved, getSquad }) {
  let drawerClose = null;
  let unbindSlide = null;
  let jiraHost = null;
  let serverAiStatus = null;
  let activeSquad = '';

  function close() {
    unbindSlide?.();
    unbindSlide = null;
    drawerClose?.();
    drawerClose = null;
  }

  async function handleSlideUpload(file, bodyEl, projects, csv, quarterLabel, priorData) {
    if (!file || !bodyEl) return;
    bodyEl.innerHTML = `<div class="gov-baseline-job" role="status" aria-live="polite" aria-busy="true">
      <p class="gov-baseline-loading">${escapeHtml(COPY.baselineSlideReading)}</p>
      <progress max="100" value="2"></progress><p class="gov-baseline-job-stage">Secure import accepted.</p></div>`;
    try {
      const updateProgress = (job = {}) => {
        const host = bodyEl.querySelector('.gov-baseline-job');
        if (!host) return;
        const progress = host.querySelector('progress');
        const sentence = host.querySelector('.gov-baseline-job-stage');
        if (progress) progress.value = Number(job.progress) || 2;
        if (sentence) sentence.textContent = job.message || job.stage || 'Processing securely…';
      };
      const data = await postSlidePropose({
        file, projects, projectsCsv: csv, squad: activeSquad, onProgress: updateProgress,
      });
      const confirmable = (data.candidates || []).filter((c) => c.issueKey);
      if (!confirmable.length && !(data.extracted || []).length) {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        bodyEl.innerHTML = renderBaselineEmpty(data, jiraUrl, csv, quarterLabel, true, '', serverAiStatus);
        bindPanel(bodyEl, priorData || data, projects, csv, quarterLabel);
        return;
      }
      bodyEl.innerHTML = renderBaselineSlideReview(data, csv, quarterLabel, jiraHost, serverAiStatus);
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    } catch (err) {
      const message = err?.message || COPY.baselineProposeFailed;
      // Always restore a usable panel. A transient toast alone leaves users on a stale spinner.
      if (priorData?.candidates?.length) {
        bodyEl.innerHTML = renderBaselineCandidates(priorData, csv, quarterLabel, jiraHost, serverAiStatus, message);
      } else {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        bodyEl.innerHTML = renderBaselineEmpty(priorData || { candidates: [] }, jiraUrl, csv, quarterLabel, true, message, serverAiStatus);
      }
      bindPanel(bodyEl, priorData || { candidates: [] }, projects, csv, quarterLabel);
      bodyEl.querySelector('.gov-baseline-error')?.focus?.();
    }
  }

  function bindPanel(el, data, projects, csv, quarterLabel) {
    unbindSlide?.();
    el.querySelector('[data-baseline-close]')?.addEventListener('click', close);
    el.querySelector('#gov-baseline-refresh')?.addEventListener('click', () => {
      close();
      onSaved?.();
      open(true);
    });
    el.querySelector('#gov-baseline-refresh-list')?.addEventListener('click', () => {
      close();
      open(true);
    });
    const dropZone = el.querySelector('#gov-baseline-slide-drop');
    if (dropZone) {
      unbindSlide = bindSlideDropZone(dropZone, (file) => {
        void handleSlideUpload(file, el, projects, csv, quarterLabel, data);
      });
    }
    el.querySelector('#gov-baseline-confirm')?.addEventListener('click', async () => {
      const checked = [...el.querySelectorAll('[data-candidate]:checked:not([disabled])')];
      const items = checked.map((inp) => {
        const idx = inp.getAttribute('data-candidate');
        const c = data.candidates[Number(idx)] || data.candidates.find((_, i) => String(i) === idx);
        if (!c) return null;
        const act = c.epicActivity;
        return {
          issueKey: c.issueKey,
          title: c.title,
          originalText: c.slideMatch?.bullet || c.slideMatch?.title || c.title,
          squad: c.squad || projects[0],
          month: c.slideMatch?.month || '',
          theme: c.slideMatch?.theme || '',
          businessValue: c.slideMatch?.businessValue || '',
          confidence: c.confidence,
          sourceSpan: c.slideMatch?.sourceSpan,
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
        const current = await fetchJson(`/api/governance/pi-baseline?piName=${encodeURIComponent(piName)}`, {}, 'pi-baseline-version');
        await fetchJson('/api/governance/pi-baseline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            piName,
            projects,
            source: data.method,
            sourceType: data.pages?.length > 1 ? 'full-deck' : 'squad-image',
            sourceLabel: data.source?.filename || '',
            artifactHash: data.artifactHash || '',
            expectedRevision: Number(current?.baseline?.revision) || 0,
            supersedesId: current?.baseline?.id || '',
            modelContribution: data.models || [],
            committedItems: items,
            approvedBy: 'governance-wizard',
          }),
        }, 'pi-baseline-save');
        close();
        onSaved?.();
      } catch (err) {
        showInlineToast(el, err?.message || COPY.baselineSaveFailed, 'error');
      }
    });
  }

  async function open(forceRefresh = false, squad = '') {
    close();
    activeSquad = squad || getSquad?.() || '';
    serverAiStatus = await fetchAiProviderStatus(forceRefresh);
    const fullCsv = getProjectsCsv?.() || 'MPSA,MAS';
    // If a specific squad is provided, scope the wizard to that single squad's project
    const csv = activeSquad ? activeSquad : fullCsv;
    const projects = csv.split(',').map((p) => p.trim()).filter(Boolean);
    const quarterLabel = getQuarterLabel?.() || readGovernanceQuarter();
    const quarterQs = quarterLabel ? `&quarter=${encodeURIComponent(quarterLabel)}` : '';
    const squadQs = activeSquad ? `&squad=${encodeURIComponent(activeSquad)}` : '';

    jiraHost = await resolveJiraBrowseHost(projects);

    const { close: closeFn, el } = openRightDrawer({
      title: baselineDrawerTitle(csv, quarterLabel),
      bodyHtml: renderBaselineLoading(),
    });
    drawerClose = closeFn;
    const body = el.querySelector('.gov-right-drawer-body');
    if (!body) return;

    let data = { method: 'manual', candidates: [], guidanceCode: null };
    const jiraUrlPromise = resolveJiraBoardUrl(projects);
    const proposeQs = `${forceRefresh ? '&refresh=1' : ''}${quarterQs}`;
    try {
      data = await fetchJson(
        `/api/governance/pi-baseline/propose?projects=${encodeURIComponent(csv)}${proposeQs}${squadQs}`,
        { headers: aiProviderRequestHeaders() },
        'pi-baseline-propose',
      );
    } catch (err) {
      const jiraUrl = await jiraUrlPromise;
      body.innerHTML = renderBaselineEmpty(
        { guidanceCode: null },
        jiraUrl,
        csv,
        quarterLabel,
        false,
        err?.message || COPY.baselineProposeFailed,
        serverAiStatus,
      );
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    if (!data.candidates?.length) {
      const jiraUrl = await jiraUrlPromise;
      const partial = Boolean(data.guidanceCode === 'jira-unmatched' || (data.totalBoardEpics || 0) > 0);
      body.innerHTML = renderBaselineEmpty(data, jiraUrl, csv, quarterLabel, partial, '', serverAiStatus);
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    body.innerHTML = renderBaselineCandidates(data, csv, quarterLabel, jiraHost, serverAiStatus);
    bindPanel(body, data, projects, csv, quarterLabel);
  }

  return { open, close };
}
