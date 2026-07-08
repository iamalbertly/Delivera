/**
 * PI baseline propose + confirm wizard (right drawer).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { aiProviderRequestHeaders, fetchAiProviderStatus } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { readGovernanceQuarter } from './Delivera-App-Shared-PIBaseline-Slide-01Client-Helper.js';
import {
  drawerTitle,
  resolveJiraBoardUrl,
  resolveJiraBrowseHost,
} from './Delivera-App-Governance-Brief-PIBaseline-02Wizard-Render-Rows-UI.js';
import {
  renderCandidates,
  renderEmpty,
  renderLoading,
} from './Delivera-App-Governance-Brief-PIBaseline-03Wizard-Render-Shell-UI.js';
import { createPiBaselineWizardActions } from './Delivera-App-Governance-Brief-PIBaseline-04Wizard-Actions-Controller.js';

/**
 * @param {object} opts
 * @param {() => string} opts.getProjectsCsv
 * @param {() => string} [opts.getQuarterLabel]
 * @param {() => void} [opts.onSaved]
 */
export function mountPIBaselineWizard({ getProjectsCsv, getQuarterLabel, onSaved }) {
  let drawerClose = null;
  const state = {
    unbindSlide: null,
    unbindCreated: null,
    jiraHost: null,
    serverAiStatus: null,
    lastSlideData: null,
    lastProjects: [],
    lastCsv: '',
    lastQuarter: '',
    lastBodyEl: null,
  };

  function close() {
    state.unbindSlide?.();
    state.unbindSlide = null;
    state.unbindCreated?.();
    state.unbindCreated = null;
    drawerClose?.();
    drawerClose = null;
    state.lastBodyEl = null;
  }

  const actions = createPiBaselineWizardActions({
    state,
    close,
    onSaved,
    open: (...args) => open(...args),
  });
  const { bindPanel, reconcileFromResolved } = actions;

  async function open(forceRefresh = false, opts = {}) {
    close();
    const slideMode = opts?.initialMode === 'slide';
    state.serverAiStatus = await fetchAiProviderStatus(forceRefresh);
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    const projects = csv.split(',').map((p) => p.trim()).filter(Boolean);
    const quarterLabel = getQuarterLabel?.() || readGovernanceQuarter();
    const quarterQs = quarterLabel ? `&quarter=${encodeURIComponent(quarterLabel)}` : '';

    state.jiraHost = await resolveJiraBrowseHost(projects);

    const { close: closeFn, el } = openRightDrawer({
      title: drawerTitle(csv, quarterLabel),
      bodyHtml: renderLoading(),
    });
    drawerClose = closeFn;
    const body = el.querySelector('.gov-right-drawer-body');
    if (!body) return;

    const onCreated = (evt) => {
      if (!state.lastSlideData?.resolved?.length || !state.lastBodyEl) return;
      const keys = evt?.detail?.createdKeys || [];
      if (!keys.length && evt?.detail?.source !== 'work-draft') return;
      void reconcileFromResolved(state.lastBodyEl, state.lastProjects, state.lastCsv, state.lastQuarter, state.lastSlideData);
    };
    window.addEventListener('app:piBaselineEpicsCreated', onCreated);
    state.unbindCreated = () => window.removeEventListener('app:piBaselineEpicsCreated', onCreated);

    let data = { method: 'manual', candidates: [], guidanceCode: null };
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
      body.innerHTML = renderEmpty(
        { guidanceCode: null },
        jiraUrl,
        csv,
        quarterLabel,
        false,
        err?.message || COPY.baselineProposeFailed,
        state.serverAiStatus,
      );
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    if (!data.candidates?.length) {
      const jiraUrl = await jiraUrlPromise;
      const partial = Boolean(data.guidanceCode === 'jira-unmatched' || (data.totalBoardEpics || 0) > 0);
      body.innerHTML = renderEmpty(data, jiraUrl, csv, quarterLabel, partial, '', state.serverAiStatus);
      if (slideMode) {
        const drop = body.querySelector('.gov-baseline-optional');
        drop?.setAttribute('open', '');
      }
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    if (slideMode) {
      body.innerHTML = renderEmpty(data, await jiraUrlPromise, csv, quarterLabel, true, '', state.serverAiStatus);
      const drop = body.querySelector('.gov-baseline-optional');
      drop?.setAttribute('open', '');
      bindPanel(body, data, projects, csv, quarterLabel);
      return;
    }

    body.innerHTML = renderCandidates(data, csv, quarterLabel, state.jiraHost, state.serverAiStatus);
    bindPanel(body, data, projects, csv, quarterLabel);
  }

  return { open, close };
}
