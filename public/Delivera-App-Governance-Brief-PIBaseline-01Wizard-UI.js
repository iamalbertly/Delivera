/**
 * PI baseline propose + confirm wizard (right drawer).
 */
import {
  COPY,
  businessTitleFromSummary,
  guidanceCodeToHint,
  humanEpicActivityLabel,
} from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { aiProviderRequestHeaders, fetchAiProviderStatus, hasAiProviderKey } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { postSlidePropose, readGovernanceQuarter } from './Delivera-App-Shared-PIBaseline-Slide-01Client-Helper.js';
import { bindSlideDropZone } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

let cachedJiraBrowseHost = null;

function renderCreateWorkButton(projectsCsv) {
  return `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create promised work in Jira.">Create work</button>`;
}

function renderStepsFold(open = false) {
  return `
    <details class="gov-baseline-steps-fold"${open ? ' open' : ''}>
      <summary>How this works</summary>
      <ol class="gov-baseline-steps">
        <li>${escapeHtml(COPY.baselineStep1)}</li>
        <li>${escapeHtml(COPY.baselineStep2)}</li>
        <li>${escapeHtml(COPY.baselineStep3)}</li>
      </ol>
    </details>`;
}

function renderContextBanner(projectsCsv, quarterLabel) {
  const projects = projectsCsv.split(',').map((p) => p.trim()).filter(Boolean).join(', ') || '—';
  const quarter = quarterLabel || 'Not set';
  return `
    <div class="gov-baseline-context" data-testid="gov-baseline-context">
      <span><strong>Project:</strong> ${escapeHtml(projects)}</span>
      <span><strong>Quarter:</strong> ${escapeHtml(quarter)}</span>
      <p class="gov-baseline-context-why">${escapeHtml(COPY.piBaselineWhy)}</p>
    </div>`;
}

function fewItemsBanner(data) {
  const n = (data.candidates || []).length;
  const total = Number(data.totalBoardEpics) || 0;
  if (n >= 3 && !(total > n)) return '';
  const msg = COPY.piBaselineFewItems.replace('{n}', String(n));
  return `<p class="gov-baseline-few-items" role="status">${escapeHtml(msg)}</p>`;
}

function slideUploadInner(serverAiStatus = null) {
  const serverReady = Boolean(serverAiStatus?.slideVisionReady) && !hasAiProviderKey();
  const keyHint = (!serverReady && !hasAiProviderKey())
    ? `<p class="gov-inbox-hint gov-baseline-ai-hint" data-ai-key-hint="1">${escapeHtml(COPY.aiKeyRequiredSlide)} <a href="/settings">Settings</a></p>`
    : '';
  const serverHint = serverReady
    ? `<p class="gov-inbox-hint gov-baseline-ai-hint gov-baseline-ai-hint--ready" data-ai-server-ready="1">${escapeHtml(COPY.aiSlideServerReady.replace('{label}', serverAiStatus?.label || 'server'))}</p>`
    : '';
  return `
    <label class="gov-baseline-slide-drop" id="gov-baseline-slide-drop" tabindex="0">
      <span>${escapeHtml(COPY.baselineSlideUpload)}</span>
      <span class="gov-baseline-slide-hint">Drag &amp; drop, click, or paste (Ctrl+V)</span>
      <input type="file" id="gov-baseline-slide-input" accept="image/png,image/jpeg,image/webp" />
    </label>
    ${serverHint}${keyHint}`;
}

function slideUploadOptional(collapsed = true, serverAiStatus = null) {
  return `
    <details class="gov-baseline-optional"${collapsed ? '' : ' open'}>
      <summary>${escapeHtml(COPY.piBaselineOptionalSlide)}</summary>
      ${slideUploadInner(serverAiStatus)}
    </details>`;
}

function epicKeyLine(issueKey, jiraHost) {
  if (!issueKey) return '';
  const k = escapeHtml(issueKey);
  if (jiraHost) {
    return `<span class="gov-baseline-row-key"><a href="${escapeHtml(jiraHost)}/browse/${k}" target="_blank" rel="noopener">${k}</a></span>`;
  }
  return `<span class="gov-baseline-row-key">${k}</span>`;
}

function activitySubline(c) {
  const label = humanEpicActivityLabel(c?.epicActivity || {});
  return label ? `<span class="gov-baseline-activity">${escapeHtml(label)}</span>` : '';
}

function candidateRow(c, i, jiraHost) {
  const canConfirm = Boolean(c.issueKey);
  const title = businessTitleFromSummary(c.title || c.summary || '', 200);
  return `
    <label class="gov-baseline-row${canConfirm ? '' : ' gov-baseline-row--muted'}" data-testid="gov-baseline-row">
      <input type="checkbox" ${canConfirm && c.selected !== false ? 'checked' : ''} ${canConfirm ? '' : 'disabled'} data-candidate="${i}" />
      <span class="gov-baseline-row-body">
        <span class="gov-baseline-row-title">${escapeHtml(title)}</span>
        ${epicKeyLine(c.issueKey, jiraHost)}
        ${activitySubline(c)}
      </span>
    </label>`;
}

function drawerTitle(projectsCsv, quarterLabel) {
  const projects = projectsCsv.split(',').map((p) => p.trim()).filter(Boolean);
  const pk = projects.length === 1 ? projects[0] : projects.join('+');
  const parts = [COPY.piBaselineDrawerTitle];
  if (pk) parts.push(pk);
  if (quarterLabel) parts.push(quarterLabel);
  return parts.join(' · ');
}

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

function resolveHint(data, partial = false) {
  if (data.guidanceCode) return guidanceCodeToHint(data.guidanceCode);
  if (data.guidance) return data.guidance;
  return partial ? COPY.baselineEmptyHintPartial : COPY.baselineEmptyHint;
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

  function renderLoading() {
    return `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineLoading)}</p>`;
  }

  function renderBaselineWizardShell({
    mode,
    data,
    projectsCsv,
    quarterLabel,
    listHtml = '',
    extraHint = '',
    showConfirm = false,
    showRefresh = false,
    showCreate = false,
    jiraUrl = '',
    stepsOpen = false,
    slideCollapsed = true,
    serverAiStatus = null,
  }) {
    const title = mode === 'slide'
      ? COPY.baselineSlideMethod
      : mode === 'empty'
        ? COPY.baselineTitle
        : `${COPY.baselineConfirmTitle} (${(data.candidates || []).length})`;
    const hint = mode === 'candidates' || mode === 'slide'
      ? COPY.baselineConfirmHint
      : extraHint;
    const confirmBtn = showConfirm
      ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm" data-testid="gov-baseline-save">${escapeHtml(COPY.baselineConfirmBtn)}</button>`
      : '';
    const refreshBtn = showRefresh
      ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-refresh">${escapeHtml(COPY.refreshBrief)}</button>`
      : '';
    const jiraBtn = jiraUrl
      ? `<a class="btn btn-secondary btn-compact" href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>`
      : '';
    const createBtn = showCreate ? renderCreateWorkButton(projectsCsv) : '';
    const slideBlock = mode === 'empty' ? slideUploadOptional(false, serverAiStatus) : slideUploadOptional(slideCollapsed, serverAiStatus);
    const refreshListBtn = mode === 'candidates' || mode === 'slide'
      ? `<button type="button" class="btn btn-link btn-compact" id="gov-baseline-refresh-list">${escapeHtml(COPY.refreshBrief)} list</button>`
      : '';

    return `
      <div class="gov-baseline-wizard" data-propose-method="${escapeHtml(data.method || 'manual')}">
        ${renderContextBanner(projectsCsv, quarterLabel)}
        <p class="gov-baseline-wizard-title">${escapeHtml(title)}</p>
        ${renderStepsFold(stepsOpen || mode === 'empty')}
        ${hint ? `<p class="gov-inbox-hint">${escapeHtml(hint)}</p>` : ''}
        ${mode === 'candidates' || mode === 'slide' ? fewItemsBanner(data) : ''}
        ${listHtml}
        ${slideBlock}
        <div class="gov-baseline-actions">
          ${createBtn}
          ${confirmBtn}
          ${refreshBtn}
          ${refreshListBtn}
          ${jiraBtn}
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  function renderEmpty(data, jiraUrl, projectsCsv, quarterLabel, partial = false, errorHint = '', serverAiStatus = null) {
    return renderBaselineWizardShell({
      mode: 'empty',
      data,
      projectsCsv,
      quarterLabel,
      extraHint: errorHint || resolveHint(data, partial),
      showRefresh: true,
      showCreate: true,
      jiraUrl,
      stepsOpen: true,
      slideCollapsed: false,
      serverAiStatus,
    });
  }

  function renderSlideReview(data, projectsCsv, quarterLabel) {
    const extracted = (data.extracted || []).slice(0, 12).map((r) => `
      <li>${escapeHtml([r.month, r.theme, r.bullet].filter(Boolean).join(' · '))}</li>`).join('');
    const unmatched = (data.unmatched || []).map((c, i) => candidateRow(c, `u-${i}`, jiraHost)).join('');
    const rows = (data.candidates || []).map((c, i) => candidateRow(c, i, jiraHost)).join('');
    const hasConfirmable = (data.candidates || []).some((c) => c.issueKey);
    const listHtml = `
      ${data.parseError ? `<p class="gov-inbox-hint">${escapeHtml(data.parseError)}</p>` : ''}
      <ul class="gov-baseline-extracted">${extracted}</ul>
      ${unmatched ? `<p class="gov-inbox-hint">From slide — not in Jira yet:</p><div class="gov-baseline-list">${unmatched}</div>` : ''}
      <div class="gov-baseline-list">${rows}</div>`;
    return renderBaselineWizardShell({
      mode: 'slide',
      data,
      projectsCsv,
      quarterLabel,
      listHtml,
      showConfirm: hasConfirmable,
      showCreate: !hasConfirmable && Boolean(extracted || unmatched),
      slideCollapsed: true,
      serverAiStatus,
    });
  }

  function renderCandidates(data, projectsCsv, quarterLabel) {
    const rows = (data.candidates || []).map((c, i) => candidateRow(c, i, jiraHost)).join('');
    const few = (data.candidates || []).length <= 3;
    return renderBaselineWizardShell({
      mode: 'candidates',
      data,
      projectsCsv,
      quarterLabel,
      listHtml: `<div class="gov-baseline-list">${rows}</div>`,
      showConfirm: true,
      slideCollapsed: true,
      stepsOpen: !few,
      serverAiStatus,
    });
  }

  async function handleSlideUpload(file, bodyEl, projects, csv, quarterLabel, priorData) {
    if (!file || !bodyEl) return;
    bodyEl.innerHTML = `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineSlideReading)}</p>`;
    try {
      const data = await postSlidePropose({ file, projects, projectsCsv: csv, squad: activeSquad });
      const confirmable = (data.candidates || []).filter((c) => c.issueKey);
      if (!confirmable.length && !(data.extracted || []).length) {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        bodyEl.innerHTML = renderEmpty(data, jiraUrl, csv, quarterLabel, true);
        bindPanel(bodyEl, priorData || data, projects, csv, quarterLabel);
        return;
      }
      bodyEl.innerHTML = renderSlideReview(data, csv, quarterLabel);
      bindPanel(bodyEl, data, projects, csv, quarterLabel);
    } catch (err) {
      // Render candidates FIRST, then show toast — otherwise innerHTML wipe destroys the toast
      if (priorData?.candidates?.length) {
        bodyEl.innerHTML = renderCandidates(priorData, csv, quarterLabel);
        bindPanel(bodyEl, priorData, projects, csv, quarterLabel);
      }
      showInlineToast(bodyEl, err?.message || COPY.baselineProposeFailed, 'error');
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
          squad: c.squad || projects[0],
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
      title: drawerTitle(csv, quarterLabel),
      bodyHtml: renderLoading(),
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
      body.innerHTML = renderEmpty(
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
      body.innerHTML = renderEmpty(data, jiraUrl, csv, quarterLabel, partial, '', serverAiStatus);
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    body.innerHTML = renderCandidates(data, csv, quarterLabel);
    bindPanel(body, data, projects, csv, quarterLabel);
  }

  return { open, close };
}
