/**
 * Governance Brief page controller — thin orchestrator.
 */
import { mountGovernanceScopeBar } from './Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js';
import { openScopeIntelligenceDrawer, scopeCapsuleCounts } from './Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js';
import { mountGovernanceInbox } from './Delivera-App-Governance-Inbox-01Render-UI.js';
import { mountFeedbackLabButton } from './Delivera-App-Governance-Brief-21Render-FeedbackImprovementCenter-UI.js';
import { mountStickyMicroAnswer, bindStickyScroll } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { govPage, $, projectsCsv } from './Delivera-Governance-Brief-Page-01Context.js';
import { invalidateBriefCacheEntry } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import { loadBrief, copyBrief, setLoadBriefForce } from './Delivera-Governance-Brief-Page-03Load-Controller.js?v=20260719e';
import { bindGovernancePageInteractions, openInboxNudgeReview, ensurePortfolioHeatDelegation } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';

function installExtensionTrustHint() {
  if (window.__deliveraExtTrustHint) return;
  window.__deliveraExtTrustHint = true;
  const show = () => document.getElementById('gov-extension-trust-hint')?.removeAttribute('hidden');
  const origError = console.error;
  console.error = (...args) => {
    const msg = args.map((a) => String(a || '')).join(' ');
    if (/runtime\.lastError|message port closed|extension/i.test(msg)) show();
    return origError.apply(console, args);
  };
}

function init() {
  installExtensionTrustHint();
  govPage.els.freshness = $('gov-freshness');
  govPage.els.piStripMount = $('gov-pi-strip-mount');
  govPage.els.stickyAnswerMount = $('gov-sticky-answer-mount');
  govPage.els.feedbackLabMount = $('gov-feedback-lab-mount');
  govPage.els.workerReceiptMount = $('gov-worker-receipt-mount');
  govPage.els.answerMount = $('gov-answer-mount');
  govPage.els.setupDebtMount = $('gov-setup-debt-mount');
  govPage.els.verdictMount = $('gov-verdict-mount');
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
  mountStickyMicroAnswer(govPage.els.stickyAnswerMount);
  bindStickyScroll(120);
  govPage.scopeBarApi = mountGovernanceScopeBar({
    mount: $('gov-scope-bar-mount'),
    onRefresh: (opts) => loadBrief({ force: opts?.force === true }),
    onScopeChange: () => {
      invalidateBriefCacheEntry(
        projectsCsv(),
        govPage.scopeBarApi?.getQuarterLabel?.() || '',
        govPage.scopeBarApi?.getPeriodWindow?.() || '',
      );
      setLoadBriefForce(true);
      loadBrief({ force: true });
    },
    onOpenDrawer: () => { if (govPage.lastBrief) openScopeIntelligenceDrawer(govPage.lastBrief); },
    getScopeCounts: () => scopeCapsuleCounts(govPage.lastBrief) || {},
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
    const receipt = ev.target.closest('[data-worker-receipt-open]');
    if (!receipt || !govPage.inboxApi?.getInboxTotal?.()) return;
    if (ev.target.closest('a')) return;
    ev.preventDefault();
    govPage.inboxApi.openQueueTab?.('doNow');
  }, true);
  govPage.els.actionClustersMount?.addEventListener('click', (event) => {
    if (event.target.closest('#gov-owner-check-setup')) {
      govPage.els.setupDebtMount?.scrollIntoView?.({ behavior: 'smooth' });
    }
  });
  bindGovernancePageInteractions();
  ensurePortfolioHeatDelegation();
  initGlobalOutcomeModal();
  loadBrief();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
