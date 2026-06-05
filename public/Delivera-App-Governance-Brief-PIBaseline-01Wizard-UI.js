/**
 * PI baseline propose + confirm wizard (right drawer).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { aiProviderRequestHeaders, hasAiProviderKey, readAiProviderPref } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { GOVERNANCE_QUARTER_KEY } from './Delivera-Shared-Storage-Keys.js';
import { resizeImageFileToBase64, bindSlideDropZone } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function activitySubline(c) {
  const label = c?.epicActivity?.activityLabel || '';
  return label ? `<span class="gov-baseline-activity">${escapeHtml(label)}</span>` : '';
}

function candidateRow(c, i) {
  const key = c.issueKey ? escapeHtml(c.issueKey) : '—';
  const canConfirm = Boolean(c.issueKey);
  return `
    <label class="gov-baseline-row${canConfirm ? '' : ' gov-baseline-row--muted'}">
      <input type="checkbox" ${canConfirm && c.selected !== false ? 'checked' : ''} ${canConfirm ? '' : 'disabled'} data-candidate="${i}" />
      <span>${key} — ${escapeHtml((c.title || '').slice(0, 60))}${activitySubline(c)}</span>
    </label>`;
}

async function resolveJiraBoardUrl(projects) {
  const csv = (projects || []).join(',') || 'MPSA';
  try {
    const data = await fetchJson(`/api/boards.json?projects=${encodeURIComponent(csv)}`, {}, 'baseline-boards');
    const host = data?.jiraBrowseHost;
    const board = (data?.boards || [])[0];
    const key = board?.projectKey || projects[0];
    if (host && key) return `${host}/browse/${key}`;
  } catch (_) { /* ignore */ }
  return null;
}

function readQuarterHint() {
  try {
    return String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * @param {object} opts
 * @param {() => string} opts.getProjectsCsv
 * @param {() => void} [opts.onSaved]
 */
export function mountPIBaselineWizard({ getProjectsCsv, onSaved }) {
  let drawerClose = null;
  let unbindSlide = null;

  function close() {
    unbindSlide?.();
    unbindSlide = null;
    drawerClose?.();
    drawerClose = null;
  }

  function renderLoading() {
    return `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineLoading)}</p>`;
  }

  function slideUploadBlock() {
    if (!hasAiProviderKey()) {
      return `<p class="gov-inbox-hint gov-baseline-ai-hint">Add an <a href="/settings">OpenAI or Claude key in Settings</a> to read PI plan slides (drag image here).</p>`;
    }
    return `
      <label class="gov-baseline-slide-drop" id="gov-baseline-slide-drop">
        <span>${escapeHtml(COPY.baselineSlideUpload)}</span>
        <span class="gov-baseline-slide-hint">Drag &amp; drop or click</span>
        <input type="file" id="gov-baseline-slide-input" accept="image/png,image/jpeg,image/webp" />
      </label>`;
  }

  function renderEmpty(guidance, jiraUrl, projectsCsv, partial = false) {
    const jiraBtn = jiraUrl
      ? `<a class="btn btn-secondary btn-compact" href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>`
      : '';
    const createBtn = `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create PI epic work in Jira.">Create work</button>`;
    const hint = guidance || (partial ? COPY.baselineEmptyHintPartial : COPY.baselineEmptyHint);
    return `
      <div class="gov-baseline-wizard">
        <p class="gov-baseline-wizard-title">${escapeHtml(COPY.baselineTitle)}</p>
        <ol class="gov-baseline-steps">
          <li>${escapeHtml(COPY.baselineStep1)}</li>
          <li>${escapeHtml(COPY.baselineStep2)}</li>
          <li>${escapeHtml(COPY.baselineStep3)}</li>
        </ol>
        <p class="gov-inbox-hint">${escapeHtml(hint)}</p>
        ${slideUploadBlock()}
        <div class="gov-baseline-actions">
          ${createBtn}
          ${jiraBtn}
          <button type="button" class="btn btn-primary btn-compact" id="gov-baseline-refresh">${escapeHtml(COPY.refreshBrief)}</button>
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  function renderSlideReview(data, projectsCsv = '') {
    const extracted = (data.extracted || []).slice(0, 12).map((r) => `
      <li>${escapeHtml([r.month, r.theme, r.bullet].filter(Boolean).join(' · '))}</li>`).join('');
    const unmatched = (data.unmatched || []).map((c, i) => candidateRow(c, `u-${i}`)).join('');
    const rows = (data.candidates || []).map((c, i) => candidateRow(c, i)).join('');
    const hasConfirmable = (data.candidates || []).some((c) => c.issueKey);
    const createBtn = (!hasConfirmable && (extracted || unmatched))
      ? `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create PI epic work in Jira.">Create work</button>`
      : '';
    return `
      <div class="gov-baseline-wizard">
        <p class="gov-baseline-wizard-title">${escapeHtml(COPY.baselineSlideMethod)}</p>
        ${data.parseError ? `<p class="gov-inbox-hint">${escapeHtml(data.parseError)}</p>` : ''}
        <ul class="gov-baseline-extracted">${extracted}</ul>
        ${unmatched ? `<p class="gov-inbox-hint">From slide — not in Jira yet:</p><div class="gov-baseline-list">${unmatched}</div>` : ''}
        <div class="gov-baseline-list">${rows}</div>
        ${slideUploadBlock()}
        <div class="gov-baseline-actions">
          ${createBtn}
          ${hasConfirmable ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm">${escapeHtml(COPY.baselineConfirmBtn)}</button>` : ''}
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  function renderCandidates(data) {
    const rows = (data.candidates || []).map((c, i) => candidateRow(c, i)).join('');
    return `
      <div class="gov-baseline-wizard">
        <p class="gov-baseline-wizard-title">${escapeHtml(COPY.baselineConfirmTitle)} (${data.candidates.length})</p>
        <p class="gov-inbox-hint">${escapeHtml(COPY.baselineConfirmHint)} ${escapeHtml(data.method || 'manual')}</p>
        ${slideUploadBlock()}
        <div class="gov-baseline-list">${rows}</div>
        <div class="gov-baseline-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm">${escapeHtml(COPY.baselineConfirmBtn)}</button>
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  async function handleSlideUpload(file, bodyEl, projects, csv, priorData) {
    if (!file || !bodyEl) return;
    if (!hasAiProviderKey()) {
      showInlineToast(bodyEl, 'Add OpenAI or Claude key in Settings first.', 'error');
      return;
    }
    const pref = readAiProviderPref();
    if (pref.provider === 'gemini') {
      showInlineToast(bodyEl, 'Slide reading needs OpenAI or Claude. Change provider in Settings.', 'error');
      return;
    }
    bodyEl.innerHTML = `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineSlideReading)}</p>`;
    try {
      const { base64, mimeType } = await resizeImageFileToBase64(file);
      const quarter = readQuarterHint();
      const data = await fetchJson('/api/governance/pi-baseline/propose-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiProviderRequestHeaders() },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          projects,
          projectsCsv: csv,
          quarter,
        }),
      }, 'pi-baseline-slide');
      const confirmable = (data.candidates || []).filter((c) => c.issueKey);
      if (!confirmable.length && !(data.extracted || []).length) {
        const jiraUrl = await resolveJiraBoardUrl(projects);
        bodyEl.innerHTML = renderEmpty(data.guidance || COPY.baselineEmptyHintPartial, jiraUrl, csv, true);
        bindPanel(bodyEl, priorData || data, projects, csv);
        return;
      }
      bodyEl.innerHTML = renderSlideReview(data, csv);
      bindPanel(bodyEl, data, projects, csv);
    } catch (err) {
      showInlineToast(bodyEl, err?.message || COPY.baselineProposeFailed, 'error');
      if (priorData?.candidates?.length) {
        bodyEl.innerHTML = renderCandidates(priorData);
        bindPanel(bodyEl, priorData, projects, csv);
      }
    }
  }

  function bindPanel(el, data, projects, csv) {
    unbindSlide?.();
    el.querySelector('[data-baseline-close]')?.addEventListener('click', close);
    el.querySelector('#gov-baseline-refresh')?.addEventListener('click', () => {
      close();
      onSaved?.();
      open(true);
    });
    const dropZone = el.querySelector('#gov-baseline-slide-drop') || el.querySelector('.gov-baseline-slide-drop');
    if (dropZone) {
      unbindSlide = bindSlideDropZone(dropZone, (file) => {
        void handleSlideUpload(file, el, projects, csv, data);
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
            },
          } : {}),
        };
      }).filter((i) => i?.issueKey);
      if (!items.length) {
        showInlineToast(el, 'Select at least one epic with a Jira key.', 'error');
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

  async function open(forceRefresh = false) {
    close();
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    const projects = csv.split(',').map((p) => p.trim()).filter(Boolean);
    const quarter = readQuarterHint();
    const quarterQs = quarter ? `&quarter=${encodeURIComponent(quarter)}` : '';

    const { close: closeFn, el } = openRightDrawer({
      title: COPY.baselineTitle,
      bodyHtml: renderLoading(),
    });
    drawerClose = closeFn;
    const body = el.querySelector('.gov-right-drawer-body');
    if (!body) return;

    let data = { method: 'manual', candidates: [], guidance: null };
    const jiraUrlPromise = resolveJiraBoardUrl(projects);
    const proposeQs = `${forceRefresh ? '&refresh=1' : ''}${quarterQs}`;
    try {
      data = await fetchJson(
        `/api/governance/pi-baseline/propose?projects=${encodeURIComponent(csv)}${proposeQs}`,
        { headers: aiProviderRequestHeaders() },
        'pi-baseline-propose',
      );
    } catch (err) {
      const jiraUrl = await jiraUrlPromise;
      body.innerHTML = renderEmpty(err?.message || COPY.baselineProposeFailed, jiraUrl, csv);
      bindPanel(body, data, projects, csv);
      return;
    }

    if (!data.candidates?.length) {
      const jiraUrl = await jiraUrlPromise;
      const partial = (data.boardEpicCount || 0) > 0;
      body.innerHTML = renderEmpty(data.guidance, jiraUrl, csv, partial);
      bindPanel(body, data, projects, csv);
      return;
    }

    body.innerHTML = renderCandidates(data);
    bindPanel(body, data, projects, csv);
  }

  return { open, close };
}
