/**
 * Governance Brief page controller — thin orchestrator.
 */
import { mountGovernanceScopeBar } from './Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js';
import { openScopeIntelligenceDrawer, scopeCapsuleCounts } from './Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js';
import { mountGovernanceInbox } from './Delivera-App-Governance-Inbox-01Render-UI.js';
import { mountFeedbackLabButton } from './Delivera-App-Governance-Brief-21Render-FeedbackImprovementCenter-UI.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { govPage, $, projectsCsv, openPiBaselineWizard } from './Delivera-Governance-Brief-Page-01Context.js';
import { invalidateBriefCacheEntry } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import { invalidatePortfolioDecisionCacheEntry } from './Delivera-Shared-Portfolio-Decision-Client-Cache-01Bridge.js';
import { loadBrief, copyBrief, setLoadBriefForce } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { bindGovernancePageInteractions, openInboxNudgeReview, ensurePortfolioHeatDelegation } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';
import { installPortfolioSurfaceHook } from './Delivera-Governance-Brief-Page-06Portfolio-Render-Plugin.js';
import { paintInstantShell } from './Delivera-Shared-Instant-Shell-01UI.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';

function ensureLegacyGovernanceMounts() {
  if (document.getElementById('gov-brief-content')) return;
  const host = document.getElementById('main-content') || document.body;
  host?.insertAdjacentHTML('beforeend', `
    <section id="gov-brief-content" hidden aria-label="Legacy governance compatibility">
      <div id="gov-verdict-mount"></div>
      <div id="gov-compare-rail-mount"></div>
      <div id="gov-answer-mount"></div>
      <div id="gov-action-clusters-mount"></div>
      <div id="gov-right-rail-mount">
        <div id="gov-queue-mount"></div>
        <div id="gov-worker-receipt-mount"></div>
        <div id="gov-right-rail-proof-mount"></div>
      </div>
      <div id="gov-pi-strip-mount"></div>
      <div id="gov-feedback-lab-mount"></div>
      <div id="gov-setup-debt-mount"></div>
      <div id="gov-meeting-script-mount"></div>
      <div id="gov-measurement-mount"></div>
      <div id="gov-micro-survey-mount"></div>
      <div id="gov-proof-risks"></div>
      <details id="gov-supporting-evidence" hidden></details>
      <div id="gov-evidence"></div>
      <div id="gov-technical-details"></div>
      <div id="gov-readiness"></div>
      <div id="gov-baseline"></div>
      <div id="gov-scorecard"></div>
    </section>`);
}

function init() {
  ensureLegacyGovernanceMounts();
  govPage.els.freshness = $('gov-freshness');
  govPage.els.piStripMount = $('gov-pi-strip-mount');
  govPage.els.feedbackLabMount = $('gov-feedback-lab-mount');
  govPage.els.workerReceiptMount = $('gov-worker-receipt-mount');
  govPage.els.answerMount = $('gov-answer-mount');
  govPage.els.setupDebtMount = $('gov-setup-debt-mount');
  govPage.els.verdictMount = $('gov-verdict-mount');
  govPage.els.interventionMount = $('gov-intervention-case-mount');
  govPage.els.actionClustersMount = $('gov-action-clusters-mount');
  govPage.els.scriptMount = $('gov-meeting-script-mount');
  govPage.els.measurementMount = $('gov-measurement-mount');
  govPage.els.microSurveyMount = $('gov-micro-survey-mount');
  govPage.els.proofRisks = $('gov-proof-risks');
  govPage.els.evidence = $('gov-evidence');
  govPage.els.technical = $('gov-technical-details');
  govPage.els.readiness = $('gov-readiness');
  govPage.els.baseline = $('gov-baseline');
  govPage.els.scorecard = $('gov-scorecard');
  govPage.els.error = $('gov-error');
  const scopeMount = $('portfolio-scope-bar-mount') || $('gov-scope-bar-mount');
  const scopeBarOpts = {
    mount: scopeMount,
    onRefresh: (opts) => loadBrief({ force: opts?.force === true }),
    onScopeChange: () => {
      const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || '';
      const periodWindow = govPage.scopeBarApi?.getPeriodWindow?.() || '';
      const projects = projectsCsv();
      invalidateBriefCacheEntry(projects, quarter, periodWindow);
      invalidatePortfolioDecisionCacheEntry({
        anchor: govPage.scopeBarApi?.getAnchor?.() || projects.split(',')[0],
        periodKey: quarter,
      });
      setLoadBriefForce(true);
      loadBrief({ force: true });
    },
  };
  govPage.scopeBarApi = mountGovernanceScopeBar({
    ...scopeBarOpts,
    onOpenDrawer: () => {
      if (!govPage.lastBrief) return;
      openScopeIntelligenceDrawer(govPage.lastBrief);
    },
    getScopeCounts: () => scopeCapsuleCounts(govPage.lastBrief) || {},
    getBrief: () => govPage.lastBrief,
    getLastDecision: () => govPage.lastDecision || null,
  });
  govPage.inboxApi = mountGovernanceInbox({
    mount: $('gov-queue-mount'),
    getProjectsCsv: projectsCsv,
    onFocusConfirm: () => {},
    onRefreshBrief: loadBrief,
    onOpenNudgeReview: openInboxNudgeReview,
    briefLoading: () => !govPage.lastBrief,
  });
  document.addEventListener('click', (ev) => {
    const baselineSetup = ev.target.closest('[data-setup-baseline-ssot], [data-setup-action="set-baseline"]');
    if (baselineSetup) {
      ev.preventDefault();
      openPiBaselineWizard({ initialMode: 'slide' });
      setTimeout(() => {
        if (document.querySelector('.gov-right-drawer-panel')) return;
        openRightDrawer({
          title: 'Alignment Studio',
          panelClass: 'alignment-studio',
          bodyHtml: '<p class="governance-empty">Upload or confirm the PI baseline slide for this squad.</p>',
        });
      }, 0);
      return;
    }
    const receipt = ev.target.closest('[data-worker-receipt-open]');
    if (!receipt || !govPage.inboxApi?.getInboxTotal?.()) return;
    if (ev.target.closest('a')) return;
    ev.preventDefault();
    govPage.inboxApi.openQueueTab?.('doNow');
  }, true);
  govPage.els.actionClustersMount?.addEventListener('click', (event) => {
    if (event.target.closest('#gov-owner-check-setup')) {
      govPage.els.setupDebtMount?.querySelector('button, a')?.focus?.({ preventScroll: true });
    }
  });
  bindGovernancePageInteractions();
  ensurePortfolioHeatDelegation();
  installPortfolioSurfaceHook();
  initGlobalOutcomeModal();
  // Never leave Create drawer open across governance loads (audit: close off-screen / wrong job).
  try {
    const workDraftDrawer = document.getElementById('work-draft-drawer');
    if (workDraftDrawer) {
      workDraftDrawer.classList.remove('is-open');
      workDraftDrawer.hidden = true;
      workDraftDrawer.inert = true;
    }
    document.getElementById('work-draft-backdrop')?.classList.remove('is-visible');
    document.body.classList.remove('wdd-panel-open');
  } catch (_) { /* ignore */ }
  paintInstantShell('governance', {
    scopeLabel: govPage.scopeBarApi?.getAnchor?.() || projectsCsv().split(',')[0] || '',
  });
  window.addEventListener('delivera:surface-retry', (event) => {
    if (event.detail?.surface !== 'governance') return;
    setLoadBriefForce(true);
    void loadBrief({ force: true });
  });
  loadBrief();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
