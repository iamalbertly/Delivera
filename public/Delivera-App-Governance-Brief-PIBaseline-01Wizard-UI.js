/**
 * PI baseline propose + confirm wizard (right drawer).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

/**
 * @param {object} opts
 * @param {() => string} opts.getProjectsCsv
 * @param {() => void} [opts.onSaved]
 */
export function mountPIBaselineWizard({ getProjectsCsv, onSaved }) {
  let drawerClose = null;
  let drawerEl = null;

  function close() {
    drawerClose?.();
    drawerClose = null;
    drawerEl = null;
  }

  function renderLoading() {
    return `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineLoading)}</p>`;
  }

  function renderEmpty(guidance, jiraUrl, projectsCsv) {
    const jiraBtn = jiraUrl
      ? `<a class="btn btn-secondary btn-compact" href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>`
      : '';
    const createBtn = `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create PI epic work in Jira.">Create work</button>`;
    return `
      <div class="gov-baseline-wizard">
        <p class="gov-baseline-wizard-title">${escapeHtml(COPY.baselineTitle)}</p>
        <ol class="gov-baseline-steps">
          <li>${escapeHtml(COPY.baselineStep1)}</li>
          <li>${escapeHtml(COPY.baselineStep2)}</li>
          <li>${escapeHtml(COPY.baselineStep3)}</li>
        </ol>
        <p class="gov-inbox-hint">${escapeHtml(guidance || COPY.baselineEmptyHint)}</p>
        <div class="gov-baseline-actions">
          ${createBtn}
          ${jiraBtn}
          <button type="button" class="btn btn-primary btn-compact" id="gov-baseline-refresh">${escapeHtml(COPY.refreshBrief)}</button>
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  function renderCandidates(data, projects) {
    const rows = data.candidates.map((c, i) => `
      <label class="gov-baseline-row">
        <input type="checkbox" checked data-candidate="${i}" />
        <span>${escapeHtml(c.issueKey)} — ${escapeHtml((c.title || '').slice(0, 60))}</span>
      </label>`).join('');
    return `
      <div class="gov-baseline-wizard">
        <p class="gov-baseline-wizard-title">${escapeHtml(COPY.baselineConfirmTitle)} (${data.candidates.length})</p>
        <p class="gov-inbox-hint">${escapeHtml(COPY.baselineConfirmHint)} ${escapeHtml(data.method || 'manual')}</p>
        <div class="gov-baseline-list">${rows}</div>
        <div class="gov-baseline-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm">${escapeHtml(COPY.baselineConfirmBtn)}</button>
          <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
        </div>
      </div>`;
  }

  function bindPanel(el, data, projects) {
    el.querySelector('[data-baseline-close]')?.addEventListener('click', close);
    el.querySelector('#gov-baseline-refresh')?.addEventListener('click', () => {
      close();
      onSaved?.();
      open(true);
    });
    el.querySelector('#gov-baseline-confirm')?.addEventListener('click', async () => {
      const checked = [...el.querySelectorAll('[data-candidate]:checked')];
      const items = checked.map((inp) => {
        const idx = Number(inp.getAttribute('data-candidate'));
        const c = data.candidates[idx];
        return { issueKey: c.issueKey, title: c.title, squad: c.squad || projects[0] };
      });
      if (!items.length) return;
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
        const body = el.querySelector('.gov-right-drawer-body');
        if (body) {
          void resolveJiraBoardUrl(projects).then((jiraUrl) => {
            body.innerHTML = renderEmpty(err?.message || COPY.baselineSaveFailed, jiraUrl, projects.join(','));
            bindPanel(body, data, projects);
          });
        }
      }
    });
  }

  async function open(forceRefresh = false) {
    close();
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    const projects = csv.split(',').map((p) => p.trim()).filter(Boolean);

    const { close: closeFn, el } = openRightDrawer({
      title: COPY.baselineTitle,
      bodyHtml: renderLoading(),
    });
    drawerClose = closeFn;
    drawerEl = el;
    const body = el.querySelector('.gov-right-drawer-body');
    if (!body) return;

    let data = { method: 'manual', candidates: [], guidance: null };
    const jiraUrlPromise = resolveJiraBoardUrl(projects);
    const proposeQs = forceRefresh ? '&refresh=1' : '';
    try {
      data = await fetchJson(`/api/governance/pi-baseline/propose?projects=${encodeURIComponent(csv)}${proposeQs}`, {}, 'pi-baseline-propose');
    } catch (err) {
      const jiraUrl = await jiraUrlPromise;
      body.innerHTML = renderEmpty(err?.message || COPY.baselineProposeFailed, jiraUrl, csv);
      bindPanel(body, data, projects);
      return;
    }

    if (!data.candidates?.length) {
      const jiraUrl = await jiraUrlPromise;
      body.innerHTML = renderEmpty(data.guidance, jiraUrl, csv);
      bindPanel(body, data, projects);
      return;
    }

    body.innerHTML = renderCandidates(data, projects);
    bindPanel(body, data, projects);
  }

  return { open, close };
}
