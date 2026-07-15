/**

 * Portfolio command surface render plugin — signal, commitments, actions, carousel, decision.

 */

import { renderPortfolioSignal, renderPortfolioDataTrust } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

import { renderPortfolioCommitments } from './Delivera-App-Portfolio-Commitments-01Render-UI.js';
import { renderWhatChangedTimeline } from './Delivera-App-Portfolio-WhatChanged-01Render-UI.js';
import { renderPortfolioPreparedActions } from './Delivera-App-Portfolio-PreparedActions-01Render-UI.js';
import { shouldHidePreparedActionsSection, applyHonestTrustClamp, enrichComparisonForDiffOnly } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

import { renderPortfolioCarousel, bindPortfolioCarousel } from './Delivera-App-Portfolio-Comparison-01Carousel-UI.js';
import { renderGovernancePrioritySurface, bindGovernancePrioritySurface } from './Delivera-App-Governance-PrioritySurface-01Render-UI.js';
import { bindHoverProofCards } from './Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js';
import { rememberSurfaceHtml, clearInstantShell, renderSquadCompareSkeletonHtml } from './Delivera-Shared-Instant-Shell-01UI.js';
import {
  gradateCardStatus,
  isAttentionStatus,
} from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';
import {
  renderPortfolioDecisionPanel,
  bindPortfolioDecisionPanel,
} from './Delivera-App-Portfolio-Decision-01Panel-UI.js';
import { openPortfolioCalibrationDrawer, buildCalibrationDefenseText } from './Delivera-App-Portfolio-Actions-01Bridge.js';
import { writeTextToClipboardWithFallback } from './Delivera-Shared-Clipboard-01Bridge.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { focusProofRail } from './Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js';

import { openPortfolioTrustDrawer } from './Delivera-App-Portfolio-Trust-01Drawer-UI.js';

import { mountPortfolioAiAgentBadge } from './Delivera-App-Portfolio-AI-Agent-01Badge-UI.js';

import { govPage, $ } from './Delivera-Governance-Brief-Page-01Context.js';

import {
  readPortfolioAnchor,
  readPortfolioBaselineMode,
  isPortfolioAllAnchor,
  readScopeProjects,
} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';
import { resolveEffectiveSquad, isPortfolioAllKey } from './Delivera-Governance-EffectiveSquad-01Resolve-SSOT.js';

import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

import { hideGovernanceLoading } from './Delivera-Governance-Brief-Page-02Loading-State.js';
import { fetchPortfolioDecisionCached } from './Delivera-Shared-Portfolio-Decision-Client-Cache-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { ensureLegacyBriefSurfacesHydrated } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { mountPiFocusStrip } from './Delivera-App-Governance-PIFocus-01Strip-Render-UI.js';
import { openPiBaselineWizard } from './Delivera-Governance-Brief-Page-01Context.js';

function readCompareProjects(anchor = '') {
  const projects = readSharedProjectsCsv();
  const A = String(anchor || '').toUpperCase();
  if (isPortfolioAllAnchor(A)) return projects.filter((p) => !isPortfolioAllAnchor(p));
  return projects.filter((p) => String(p).toUpperCase() !== A);
}

async function fetchPortfolioPayload(brief, cases = [], { force = false } = {}) {
  const anchor = readPortfolioAnchor(brief?.projects || readSharedProjectsCsv());
  const compare = readCompareProjects(anchor);
  const periodKey = govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '';
  const baselineMode = govPage.scopeBarApi?.getBaselineMode?.() || readPortfolioBaselineMode();
  const gaps = brief?.meta?.setupGaps || [];
  const baselineMissing = gaps.some((g) => g.action === 'set-baseline') || baselineMode === 'none';
  const partialSquads = (brief?.squadInsights || []).filter((s) => !s.boardResolved).length;
  const briefId = String(brief?.meta?.briefId || brief?.generatedAt || '').slice(0, 64);

  const networkFetcher = async (opts = {}) => {
    try {
      return await fetchJson('/api/governance/portfolio-decision.json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brief: opts.brief ?? brief,
          anchor: opts.anchor ?? anchor,
          compare: opts.compare ?? compare,
          periodKey: opts.periodKey ?? periodKey,
          baseline: opts.baselineMode ?? baselineMode,
          baselineMissing: opts.baselineMissing ?? baselineMissing,
          partialSquads: opts.partialSquads ?? partialSquads,
          cases: opts.cases ?? cases,
          portfolioGeneral: isPortfolioAllAnchor(opts.anchor ?? anchor),
          refresh: opts.refresh ? '1' : undefined,
        }),
      }, 'portfolio-decision');
    } catch (err) {
      return {
        decision: {
          headline: isPortfolioAllAnchor(anchor) ? 'Portfolio overview' : `${anchor} needs scope and proof confirmation`,
          summary: 'Portfolio comparison is loading — refresh if this persists.',
          metrics: {
            delivery: { value: 0, peerMedian: 0 },
            offPlanLoad: { value: 0, peerMedian: 0 },
            proofConfidence: { value: 0, peerMedian: 0 },
          },
          trust: { liveCases: cases.length, nudgesReady: 0, proofLevel: 'Low' },
          drivers: [],
          affectedCommitments: [],
          preparedActions: { groups: [], items: [] },
          decisionOptions: [{ id: 'keep-funding', label: 'Keep funding', useWhen: 'Scope is confirmed', effect: 'No change', impactPreview: 'Confirm scope first.' }],
          anchorProject: anchor,
          portfolioGeneral: isPortfolioAllAnchor(anchor),
          periodKey,
          monitoring: { squadCount: compare.length + (isPortfolioAllAnchor(anchor) ? 0 : 1), commitmentCount: 0, exposedCommitmentCount: 0 },
          recommendation: { label: 'Confirm scope and proof before investment review' },
          narrative: { headline: 'Confirm scope and proof', mainIssue: 'Data loading' },
          aboveFold: { exposedCommitments: 0, actionsReady: 0, poResponsesRequired: 0 },
        },
        comparison: { cards: [], actionsStrip: {} },
        cases,
        error: err?.message,
      };
    }
  };

  const { payload } = await fetchPortfolioDecisionCached({
    anchor,
    compare,
    periodKey,
    briefId,
    brief,
    baselineMode,
    baselineMissing,
    partialSquads,
    cases,
    fetcher: networkFetcher,
    force,
  });
  return payload;
}

async function handlePortfolioDelegatedClick(ev) {

  const formatBtn = ev.target.closest('[data-calibration-format]');
  if (formatBtn) {
    ev.preventDefault();
    formatBtn.parentElement?.querySelectorAll('[data-calibration-format]').forEach((b) => b.classList.toggle('is-active', b === formatBtn));
    return;
  }

  const commitmentRow = ev.target.closest('.portfolio-commitment-row[data-commitment-issue]');
  if (commitmentRow && commitmentRow.getAttribute('data-commitment-issue')) {
    const issueKey = commitmentRow.getAttribute('data-commitment-issue');
    if (issueKey && govPage.lastBrief) {
      ev.preventDefault();
      openEvidenceDrawer(govPage.lastBrief, [{ issueKey }]);
      return;
    }
  }

  const btn = ev.target.closest('[data-portfolio-action], [data-portfolio-restore-comparison], [data-governance-action]');

  if (!btn || btn.tagName === 'A') return;

  // Audit fix: "Back to comparison" restores the pre-drill multi-squad scope.
  if (btn.hasAttribute('data-portfolio-restore-comparison')) {
    ev.preventDefault();
    govPage.scopeBarApi?.restoreComparison?.();
    govPage._portfolioBriefToken = null;
    if (govPage.lastBrief) await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
    return;
  }

  const action = btn.getAttribute('data-portfolio-action')
    || btn.getAttribute('data-governance-action');
  if (!action) return;

  // Only handle journey / portfolio actions here — leave commitment row binders alone.
  const handled = new Set([
    'review-actions', 'view-prepared-items', 'check-jira-connection', 'view-governance-evidence',
    'calibration-defense', 'copy-calibration-defense', 'copy-evidence-summary', 'how-ai-decides',
    'open-alignment-studio', 'upload-baseline-slide', 'align-board', 'nudge-plan-stories',
    'review-prepared', 'record-decision', 'refresh-brief', 'share-sponsor-brief',
    'open-baseline-image', 'expand-commitments',
  ]);
  if (!handled.has(action)) return;
  ev.preventDefault();

  const decision = govPage.lastPortfolioDecision || {};

  const cases = govPage.lastPortfolioCases || [];

  if (action === 'review-actions' || action === 'view-prepared-items' || action === 'review-prepared' || action === 'record-decision') {
    openPortfolioCalibrationDrawer(decision, cases);
  } else if (action === 'check-jira-connection' || action === 'align-board-settings') {
    showInlineToast(document.body, 'Open Settings → Integrations to verify Jira board sync for stalled squads.', 'info');
    window.location.href = '/settings#integrations';
  } else if (action === 'view-governance-evidence') {
    const brief = govPage.lastBrief || {};
    const rail = document.getElementById('gov-right-rail-proof-mount');
    if (rail && !rail.hidden && rail.querySelector('[data-direct-value="evidence"], .gov-evidence-preview')) {
      focusProofRail(rail);
      return;
    }
    openEvidenceDrawer(brief, brief?.evidencePack?.rows || [], { skipLegacyFlag: true, docked: true });
  } else if (action === 'calibration-defense' || action === 'copy-calibration-defense' || action === 'copy-evidence-summary') {
    ensureLegacyBriefSurfacesHydrated();
    const format = document.querySelector('[data-calibration-format].is-active')?.getAttribute('data-calibration-format') || 'successfactors';
    const prefix = format === 'hr-review'
      ? 'HR Review format\n'
      : format === 'hod-briefing'
        ? 'HOD Briefing format\n'
        : '';
    const text = `${prefix}${buildCalibrationDefenseText(govPage.lastBrief || {}, decision)}`;
    writeTextToClipboardWithFallback(text).then(() => {
      showInlineToast(document.getElementById('main-content'), 'Evidence summary copied', 'info');
    }).catch(() => {
      openPortfolioCalibrationDrawer(decision, cases);
    });
  } else if (action === 'how-ai-decides') openPortfolioTrustDrawer(decision);
  else if (action === 'open-alignment-studio' || action === 'upload-baseline-slide' || action === 'align-board') {
    try {
      const rawSquad = btn.getAttribute('data-squad-key') || readPortfolioAnchor(readScopeProjects());
      const squadKey = resolveEffectiveSquad({
        anchor: rawSquad,
        projects: readScopeProjects(),
        brief: govPage.lastBrief,
      });
      const wizardMode = btn.getAttribute('data-wizard-mode')
        || (action === 'align-board' ? 'board' : 'slide');
      if (isPortfolioAllKey(rawSquad) && !squadKey) {
        showInlineToast(document.getElementById('main-content'), 'Pick a squad first, then upload its PI slide.', 'info');
        return;
      }
      if (squadKey && govPage.scopeBarApi?.setAnchor) {
        try { govPage.scopeBarApi.setAnchor(squadKey); } catch (_) { /* non-fatal */ }
      }
      if (action === 'align-board' && wizardMode === 'settings') {
        window.location.href = `/settings#integrations&project=${encodeURIComponent(squadKey || '')}`;
        return;
      }
      openPiBaselineWizard({
        initialMode: wizardMode === 'create-epics' ? 'slide' : (wizardMode || 'slide'),
        focusCreateEpics: wizardMode === 'create-epics',
        projectKey: squadKey || undefined,
      });
    } catch (err) {
      console.warn('[governance] alignment studio open failed', err);
      showInlineToast(document.getElementById('main-content'), err?.message || 'Could not open Alignment Studio', 'error');
    }
  } else if (action === 'nudge-plan-stories') {
    try {
      const rawSquad = btn.getAttribute('data-squad-key') || readPortfolioAnchor(readScopeProjects());
      const squadKey = resolveEffectiveSquad({
        anchor: rawSquad,
        projects: readScopeProjects(),
        brief: govPage.lastBrief,
      });
      const pb = decision.priorityBrief || {};
      const pack = pb.evidenceCopyPack || {};
      const keys = pack.keys?.length
        ? pack.keys
        : ((decision.comparison?.cards || [])
          .find((c) => String(c.projectKey).toUpperCase() === String(squadKey).toUpperCase())
          ?.readiness?.notPlannedKeys || []);
      const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || 'current quarter';
      const owner = pack.ownerName || pack.owner || pb.ownerName || decision.recommendation?.ownerName || '';
      const recipient = owner || 'Ownership missing — assign the accountable Scrum Master or Product Owner before sending';
      const evidenceGap = keys.length
        ? `${keys.length} committed epic${keys.length === 1 ? '' : 's'} (${keys.join(', ')}) have no supporting stories on the selected Jira board.`
        : 'Committed PI work has no supporting story evidence on the selected Jira board.';
      const msg = pack.text || [
        recipient,
        '',
        `Scope: ${squadKey} · ${quarter}`,
        `Evidence gap: ${evidenceGap}`,
        'Required next step: create or link refined stories with acceptance criteria, estimates, and a target sprint before the next planning checkpoint.',
        'Complete when: every listed commitment has verifiable planned story evidence in Jira and Delivera confirms it on refresh.',
        'Consequence if unresolved: these commitments remain unverified and must not be reported as delivery-ready.',
        pack.jql ? `JQL: ${pack.jql}` : '',
      ].filter(Boolean).join('\n');
      writeTextToClipboardWithFallback(msg).then(() => {
        showInlineToast(
          document.getElementById('main-content'),
          owner ? `Accountable request copied for ${owner}` : 'Request copied, but an accountable owner must be assigned before sending',
          owner ? 'success' : 'warning',
        );
      }).catch(() => {
        showInlineToast(document.getElementById('main-content'), msg, 'info');
      });
    } catch (err) {
      console.warn('[governance] plan-stories nudge failed', err);
      showInlineToast(document.getElementById('main-content'), 'Could not build planning nudge', 'error');
    }
  } else if (action === 'copy-evidence-pack') {
    try {
      let pack = { text: '', jql: '' };
      const raw = btn.getAttribute('data-evidence-pack') || '';
      if (raw) {
        try { pack = JSON.parse(raw); } catch (_) { /* ignore */ }
      }
      if (!pack.text) pack = decision.priorityBrief?.evidenceCopyPack || {};
      const body = [pack.text, pack.jql ? `\nJQL: ${pack.jql}` : ''].filter(Boolean).join('\n');
      if (!body) {
        showInlineToast(document.getElementById('main-content'), 'No evidence keys to copy yet', 'info');
        return;
      }
      writeTextToClipboardWithFallback(body).then(() => {
        showInlineToast(document.getElementById('main-content'), 'Evidence keys + links copied', 'info');
      }).catch(() => {
        showInlineToast(document.getElementById('main-content'), body.slice(0, 200), 'info');
      });
    } catch (err) {
      console.warn('[governance] copy evidence failed', err);
    }
  } else if (action === 'expand-evidence') {
    const panel = document.querySelector('[data-testid="governance-attention-evidence"]');
    panel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  } else if (action === 'refresh-brief') {
    govPage._portfolioBriefToken = null;
    refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
    showInlineToast(document.getElementById('main-content'), 'Refreshing portfolio brief…', 'info');
  } else if (action === 'share-sponsor-brief') {
    const preview = document.querySelector('[data-testid="governance-sponsor-brief-preview"]');
    const md = decision.sponsorBriefMarkdown
      || preview?.querySelector('pre')?.textContent
      || '';
    if (preview) preview.hidden = false;
    if (md) {
      writeTextToClipboardWithFallback(md).then(() => {
        showInlineToast(document.getElementById('main-content'), 'Sponsor brief copied', 'info');
      }).catch(() => {
        showInlineToast(document.getElementById('main-content'), 'Sponsor brief shown below', 'info');
      });
    } else {
      showInlineToast(document.getElementById('main-content'), 'No sponsor brief available yet', 'info');
    }
  } else if (action === 'open-baseline-image') {
    const brief = govPage.lastBrief || {};
    const url = brief.meta?.baselineImageUrl
      || brief.meta?.baselineSourceImageUrl
      || brief.baselineComparison?.sourceImageUrl
      || '';
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      openPiBaselineWizard({ initialMode: 'slide' });
      showInlineToast(document.getElementById('main-content'), 'Open Alignment Studio to view or upload the PI slide', 'info');
    }
  } else if (action === 'expand-commitments') {
    const overflow = btn.closest('.portfolio-commitments-more')?.querySelector('.portfolio-commitments-overflow');
    if (overflow) {
      overflow.hidden = false;
      btn.hidden = true;
    }
  }

}

/**
 * Shared live+cache mount paint — priority surface, optional legacy mounts,
 * carousel slot (full HTML or cache placeholder).
 */
function paintPortfolioMounts(decision, brief, meta = {}, opts = {}) {
  const {
    comparison = {},
    cases = [],
    mode = 'live',
    payloadError = null,
    bindDecisionConfirm = false,
  } = opts;
  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const prioritySurfaceMount = document.getElementById('governance-priority-surface-mount');
  const signalMount = $('portfolio-signal-mount');
  const commitmentsMount = $('portfolio-commitments-mount');
  const preparedMount = $('portfolio-prepared-actions-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const decisionMount = $('portfolio-decision-mount');
  const footerMount = $('portfolio-monitor-footer');
  const railCommitmentsMount = $('portfolio-rail-commitments-mount');

  if (prioritySurfaceMount) {
    const decisionWithComparison = { ...decision, comparison };
    prioritySurfaceMount.innerHTML = renderGovernancePrioritySurface(decisionWithComparison, brief, { cases });
    prioritySurfaceMount.setAttribute('data-gov-priority-rendered', '1');
    if (mode === 'cache') prioritySurfaceMount.setAttribute('data-gov-priority-cached', '1');
    else prioritySurfaceMount.removeAttribute('data-gov-priority-cached');
    const bindOpts = {
      brief,
      onSelectSquad: async (projectKey) => {
        if (!projectKey) return;
        govPage.scopeBarApi?.setAnchor?.(projectKey);
        govPage._portfolioBriefToken = null;
        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);
      },
      ...(mode === 'live'
        ? {
            onInspectEvidence: (b) => {
              openEvidenceDrawer(b || brief || govPage.lastBrief || {}, (b || brief || govPage.lastBrief)?.evidencePack?.rows || [], {
                skipLegacyFlag: true,
                docked: true,
              });
            },
          }
        : {}),
    };
    bindGovernancePrioritySurface(prioritySurfaceMount, bindOpts);
    clearInstantShell();
    prioritySurfaceMount.removeAttribute('aria-busy');
    prioritySurfaceMount.setAttribute('aria-busy', 'false');
    rememberSurfaceHtml('governance', prioritySurfaceMount.innerHTML, {
      scopeLabel: decision.anchorProject || brief?.projects?.[0] || '',
    });
  }

  if (!priorityBriefOnly && signalMount) {
    signalMount.innerHTML = renderPortfolioSignal(decision, {
      cachedAt: meta.cachedAt,
      cached: mode === 'cache' ? true : meta.cached,
      brief,
    });
    signalMount.setAttribute('data-portfolio-signal-ready', '1');
    if (mode === 'cache') signalMount.setAttribute('data-portfolio-signal-cached', '1');
    if (mode === 'live') {
      mountPiFocusStrip(brief, signalMount, { openPiBaselineWizard });
      if (payloadError) {
        signalMount.insertAdjacentHTML('afterbegin', `<p class="portfolio-signal-error" role="alert">${escapeHtml(String(payloadError))}</p>`);
      }
    }
  } else if (mode === 'live' && priorityBriefOnly && prioritySurfaceMount) {
    mountPiFocusStrip(brief, prioritySurfaceMount, { openPiBaselineWizard });
  }

  if (!priorityBriefOnly && commitmentsMount) {
    commitmentsMount.innerHTML = renderPortfolioCommitments(decision);
  }
  if (railCommitmentsMount) railCommitmentsMount.innerHTML = renderWhatChangedTimeline(brief, decision);
  if (!priorityBriefOnly && preparedMount) {
    const hidePrepared = shouldHidePreparedActionsSection(decision, brief);
    preparedMount.innerHTML = hidePrepared ? '' : renderPortfolioPreparedActions(decision);
    preparedMount.hidden = hidePrepared;
  }

  if (mode === 'live') {
    const commitmentRows = decision.priorityBrief?.detailRows || [];
    const daysRemaining = Number(decision.timebox?.remainingDays) || 0;
    const enrichedComparison = {
      ...comparison,
      cards: (comparison.cards || []).map((card) => {
        const cardCommitments = commitmentRows.filter((row) =>
          String(row.projectKey || '').toUpperCase() === String(card.projectKey || '').toUpperCase()
        );
        const linkedCount = cardCommitments.filter((r) => r.issueKey && r.reality !== 'Unlinked').length;
        return {
          ...card,
          linkedCount,
          totalCommitments: cardCommitments.length || Number(card.metrics?.commitments) || 0,
          daysRemaining,
        };
      }),
    };
    const carouselHtml = (enrichedComparison.cards || []).length
      ? renderPortfolioCarousel(enrichedComparison, { commitmentRows, isDrill: !isPortfolioAllAnchor(decision.anchorProject || brief?.projects?.[0]) })
      : '';

    const atRiskCount = (comparison.cards || []).filter((c) => {
      const g = gradateCardStatus(c, c.metrics?.delivered, c.metrics?.proofConfidence);
      return isAttentionStatus(g.statusClass);
    }).length;
    const zeroDeliveredCount = (comparison.cards || []).filter((c) => (Number(c.metrics?.delivered) || 0) === 0).length;
    // Split "0% delivered" into two honest groups: squads with no baseline
    // (cannot score) vs squads actually blocked. Conflating them misleads the
    // PMO/Sponsor. (Audit 2026-07-15: "5 squads at 0%" conflated no-data with
    // failed delivery.)
    const noBaselineCount = (comparison.cards || []).filter((c) =>
      (Number(c.metrics?.delivered) || 0) === 0
      && (c.readiness?.gated || c.dataTrust === 'cannot-judge' || c.baselineMissing),
    ).length;
    const blockedCount = Math.max(0, zeroDeliveredCount - noBaselineCount);
    const systemicBanner = (atRiskCount >= 3 || zeroDeliveredCount >= 2)
      ? `<div class="portfolio-systemic-risk-banner" role="alert" data-testid="portfolio-systemic-risk-banner">⚠️ <strong>${
        blockedCount > 0
          ? `${blockedCount} squad${blockedCount === 1 ? '' : 's'} at 0% delivered (blocked)`
          : `${noBaselineCount} squad${noBaselineCount === 1 ? '' : 's'} need PI slides (cannot score)`
      }</strong>${
        noBaselineCount > 0 && blockedCount > 0
          ? ` · ${noBaselineCount} more cannot be scored without PI slides`
          : ''
      } — ${blockedCount > 0 ? 'possible shared root cause. Consider escalating to leadership.' : 'upload PI slides in Alignment Studio to score delivery.'}</div>`
      : '';
    const staleBanner = (meta.cachedAt && Date.now() - new Date(meta.cachedAt).getTime() > 24 * 60 * 60 * 1000)
      ? `<div class="portfolio-stale-data-banner" role="alert" data-testid="portfolio-stale-data-banner">📊 <strong>Data stale</strong> — last sync was over 24h ago. Decisions may be based on outdated information.</div>`
      : '';
    const singleSquadBanner = (comparison.cards || []).length === 1
      ? `<div class="portfolio-single-squad-deep-dive" data-testid="portfolio-single-squad-mode">
          <div class="portfolio-single-squad-banner">
            <p class="portfolio-changelog-summary">Single squad deep dive — <strong>${escapeHtml(comparison.cards[0]?.squadName || comparison.cards[0]?.projectKey || 'squad')}</strong> only.</p>
            <button type="button" class="btn btn-secondary btn-compact" data-portfolio-restore-comparison data-testid="portfolio-restore-comparison">← Back to comparison</button>
          </div>
        </div>`
      : '';
    const emptyOnboarding = !(comparison.cards || []).length && !carouselHtml
      ? `<div class="portfolio-empty-onboarding" data-testid="portfolio-empty-onboarding"><p class="portfolio-empty-onboarding-title">Welcome — select your first squad</p><p class="portfolio-empty-onboarding-hint">Pick a squad to see delivery health, proof confidence, and investment posture.</p></div>`
      : '';

    const bindCarousel = (mount) => {
      if (!mount || !carouselHtml) return;
      bindPortfolioCarousel(mount, {
        onSelectSquad: async (projectKey) => {
          if (!projectKey) return;
          govPage.scopeBarApi?.setAnchor?.(projectKey);
          govPage._portfolioBriefToken = null;
          await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);
        },
        onDrillIntoSquad: async (projectKey) => {
          if (!projectKey) return;
          govPage.scopeBarApi?.drillIntoSquad?.(projectKey);
          govPage._portfolioBriefToken = null;
          await refreshPortfolioSurface(govPage.lastBrief || brief, govPage.lastPortfolioCases);
        },
      });
      bindHoverProofCards(mount, govPage.lastBrief || brief || {});
    };

    const banners = systemicBanner + staleBanner + singleSquadBanner;
    const priorityCarouselSlot = prioritySurfaceMount?.querySelector('[data-priority-carousel-slot]');
    if (priorityCarouselSlot && carouselHtml) {
      priorityCarouselSlot.removeAttribute('data-compare-pending');
      priorityCarouselSlot.innerHTML = banners + carouselHtml;
      bindCarousel(priorityCarouselSlot);
    } else if (priorityCarouselSlot && !carouselHtml) {
      priorityCarouselSlot.setAttribute('data-compare-pending', '1');
      priorityCarouselSlot.innerHTML = emptyOnboarding
        || renderSquadCompareSkeletonHtml({ sub: 'Comparison refreshing…' });
    } else if (carouselMount) {
      carouselMount.hidden = false;
      carouselMount.innerHTML = carouselHtml ? banners + carouselHtml : emptyOnboarding;
      if (carouselHtml) bindCarousel(carouselMount);
    }
  } else if (prioritySurfaceMount?.querySelector('[data-priority-carousel-slot]')) {
    const slot = prioritySurfaceMount.querySelector('[data-priority-carousel-slot]');
    if (slot && !slot.querySelector('[data-portfolio-carousel], [data-testid="portfolio-carousel-cache-placeholder"]')) {
      const remembered = comparison?.cards?.length
        ? renderPortfolioCarousel(comparison, { commitmentRows: decision.priorityBrief?.detailRows || [] })
        : '';
      if (remembered) {
        slot.removeAttribute('data-compare-pending');
        slot.innerHTML = remembered;
      } else {
        slot.setAttribute('data-compare-pending', '1');
        slot.innerHTML = renderSquadCompareSkeletonHtml({ sub: 'Refreshing squad comparison…' });
      }
    }
  } else if (!priorityBriefOnly && carouselMount && !carouselMount.querySelector('[data-portfolio-carousel-ready]')) {
    carouselMount.hidden = false;
    carouselMount.innerHTML = renderSquadCompareSkeletonHtml({ sub: 'Refreshing squad comparison…' });
  }

  if (decisionMount && !priorityBriefOnly) {
    const freshness = mode === 'cache'
      ? (decision.dataTrust?.lastSync || 'Cached')
      : (meta.cachedAt ? '' : (decision.dataTrust?.lastSync || 'Live'));
    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision, brief)
      + (mode === 'cache' ? renderPortfolioDataTrust(decision, freshness) : '');
    if (mode === 'live') {
      decisionMount.insertAdjacentHTML('beforeend', renderPortfolioDataTrust(decision, freshness));
    }
    decisionMount.removeAttribute('aria-busy');
    decisionMount.setAttribute('aria-busy', 'false');
    if (bindDecisionConfirm) {
      bindPortfolioDecisionPanel(decisionMount, async (decisionId) => {
        try {
          await fetchJson('/api/governance/portfolio-decision/confirm', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              project: decision.anchorProject,
              periodKey: decision.periodKey,
              decisionId,
            }),
          }, 'portfolio-decision-confirm');
          showInlineToast(document.getElementById('main-content'), 'Portfolio decision recorded', 'info');
          await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);
        } catch (err) {
          showInlineToast(document.getElementById('main-content'), err?.message || 'Could not record decision', 'error');
        }
      });
    }
  } else if (decisionMount && priorityBriefOnly) {
    // Priority brief host carries the agentic rail — drop cold shimmer so aside is not a white/pulse void.
    decisionMount.innerHTML = '';
    decisionMount.hidden = true;
    decisionMount.removeAttribute('aria-busy');
    decisionMount.setAttribute('aria-busy', 'false');
  }

  if (railCommitmentsMount && priorityBriefOnly) {
    railCommitmentsMount.innerHTML = '';
    railCommitmentsMount.hidden = true;
    railCommitmentsMount.removeAttribute('aria-busy');
  }

  if (footerMount) {
    footerMount.innerHTML = '';
    footerMount.hidden = true;
  }

  return { decisionMount };
}

export async function refreshPortfolioSurface(brief, cases = govPage.lastPortfolioCases || []) {
  if (!brief) return;
  try {
  govPage.scopeBarApi?.setCacheUxState?.({ fresh: false, updating: true });
  const payload = await fetchPortfolioPayload(brief, cases);
  let { decision = {}, comparison = {}, cases: payloadCases = cases, meta = payload?.meta || {} } = payload;
  comparison = enrichComparisonForDiffOnly(comparison);
  const honest = applyHonestTrustClamp(brief, decision);
  decision = honest.decision;
  if (honest.brief?.leadershipNarrative && govPage.lastBrief?.leadershipNarrative) {
    govPage.lastBrief.leadershipNarrative.confidence = honest.brief.leadershipNarrative.confidence;
  }
  govPage.lastPortfolioMeta = meta;
  govPage.lastPortfolioDecision = decision;
  govPage.lastDecision = decision;
  govPage.lastPortfolioComparison = comparison;
  govPage.lastPortfolioCases = payloadCases;

  const { decisionMount } = paintPortfolioMounts(decision, brief, meta, {
    comparison,
    cases: payloadCases,
    mode: 'live',
    payloadError: payload.error || null,
    bindDecisionConfirm: true,
  });

  await mountPortfolioAiAgentBadge(document.getElementById('portfolio-signal-ai-mount'), decision, { compact: true });

  govPage.scopeBarApi?.setCacheUxState?.({
    fresh: !meta.cached,
    updating: false,
    cachedAt: meta.cachedAt,
  });
  govPage.scopeBarApi?.refreshCapsule?.();

  document.getElementById('main-content')?.classList.add('portfolio-shell--active');
  try {
    document.body.classList.toggle(
      'portfolio-rail-visible',
      Boolean(decisionMount?.querySelector('.portfolio-decision, #portfolio-decision')),
    );
  } catch (_) { /* ignore */ }

  document.title = 'Portfolio | Delivera';

  } finally {
    hideGovernanceLoading();
    document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  }
}

let portfolioHooked = false;

export function installPortfolioSurfaceHook() {

  if (portfolioHooked || !document.getElementById('portfolio-signal-mount')) return;

  portfolioHooked = true;

  document.getElementById('main-content')?.addEventListener('click', handlePortfolioDelegatedClick);

  window.addEventListener('delivera:scope-changed', () => {

    govPage._portfolioBriefToken = null;

    if (govPage.lastBrief) refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);

  });

  document.addEventListener('gov:open-alignment-studio', () => {
    openPiBaselineWizard({ initialMode: 'slide' });
  });

  window.addEventListener('portfolio:decision-revalidated', async (ev) => {
    const payload = ev?.detail?.payload;
    if (!payload?.decision || !govPage.lastBrief) return;
    govPage.lastPortfolioDecision = payload.decision;
    govPage.lastDecision = payload.decision;
    govPage.lastPortfolioMeta = { ...(govPage.lastPortfolioMeta || {}), ...(payload.meta || {}), cached: false };
    await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases || []);
    govPage.scopeBarApi?.setCacheUxState?.({ fresh: true, updating: false });
  });

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('flash') === 'leadership-merged') {
      showInlineToast(document.getElementById('main-content'), 'Leadership view now lives in Portfolio decisions.', 'info');
      params.delete('flash');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', next);
    }
    if (params.get('openAlignment') === '1' || params.get('openAlignment') === 'slide') {
      const mode = params.get('openAlignment') === 'slide' ? { initialMode: 'slide' } : {};
      queueMicrotask(() => openPiBaselineWizard(mode));
    }
  } catch (_) { /* ignore */ }

}

/** @deprecated Use refreshPortfolioSurface */

export const refreshPortfolio = refreshPortfolioSurface;

/**
 * Instant cached shell — paints the previous portfolio decision payload
 * from the in-memory cache so the page feels instant on reload/scope-switch,
 * before the network revalidation arrives. Falls back to a skeleton when no
 * cached decision exists yet.
 *
 * This closes the audit finding "no instant cached shell on load": the load
 * controller imported these symbols but they were never defined, which threw
 * a TypeError and aborted loadBrief() before the cached brief could render.
 */
export function paintPortfolioFromCache(cachedBrief = {}) {
  const decision = govPage.lastPortfolioDecision;
  const matchesScope = decision && cachedBrief?.projects
    && briefMatchesRequestedScope(cachedBrief, decision.anchorProject);
  if (!decision || !matchesScope) {
    paintPortfolioBentoSkeleton(cachedBrief);
    return;
  }

  paintPortfolioMounts(decision, cachedBrief, {
    cachedAt: govPage.lastPortfolioMeta?.cachedAt || '',
    cached: true,
  }, {
    comparison: govPage.lastPortfolioComparison || {},
    cases: govPage.lastPortfolioCases || [],
    mode: 'cache',
    bindDecisionConfirm: false,
  });
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
}

/**
 * Bento skeleton — only fill EMPTY legacy mounts. Never touch priority mount
 * (Instant Shell / static HTML / live PrioritySurface own that).
 */
export function paintPortfolioBentoSkeleton(seed = {}) {
  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const projects = Array.isArray(seed?.projects) ? seed.projects : [];
  const peerCount = Math.max(0, projects.length - 1);

  if (!priorityBriefOnly) {
    const signalMount = $('portfolio-signal-mount');
    if (signalMount && !signalMount.querySelector('[data-portfolio-signal], [data-testid="portfolio-signal-skeleton"]')) {
      signalMount.hidden = false;
      signalMount.removeAttribute('data-portfolio-signal-ready');
      signalMount.innerHTML = `<div class="portfolio-signal-skeleton" data-testid="portfolio-signal-skeleton" aria-label="Portfolio signal loading">
        <div class="gov-skeleton-headline"></div>
        <div class="gov-skeleton-metrics"></div>
      </div>`;
    }
    const carouselMount = $('portfolio-carousel-mount');
    if (carouselMount && !carouselMount.querySelector('[data-portfolio-carousel-ready], [data-testid="portfolio-carousel-skeleton"]')) {
      carouselMount.hidden = false;
      const peerLabel = peerCount > 0 ? `${peerCount + 1} squads` : 'squad';
      carouselMount.innerHTML = `<div class="portfolio-carousel-skeleton" data-testid="portfolio-carousel-skeleton" aria-label="Squad comparison loading">
        <p class="gov-skeleton-label">Loading ${escapeHtml(peerLabel)}…</p>
      </div>`;
    }
    const decisionMount = $('portfolio-decision-mount');
    if (decisionMount && !decisionMount.querySelector('.portfolio-decision, [data-testid="portfolio-decision-skeleton"]')) {
      decisionMount.innerHTML = `<div class="portfolio-decision-skeleton" data-testid="portfolio-decision-skeleton" aria-label="Decision panel loading">
        <div class="gov-skeleton-headline"></div>
      </div>`;
    }
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');
}

function briefMatchesRequestedScope(brief, anchor) {
  if (!brief || !anchor) return false;
  const projects = readSharedProjectsCsv();
  return projects.some((p) => String(p).toUpperCase() === String(anchor).toUpperCase());
}

