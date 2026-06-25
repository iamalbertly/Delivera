/**
 * Portfolio actions - governance evidence drawer and optional Actions deep link.
 */
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { writeTextToClipboardWithFallback } from './Delivera-Shared-Clipboard-01Bridge.js';
import { ensureLegacyBriefSurfacesHydrated } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { govPage } from './Delivera-Governance-Brief-Page-01Context.js';

export function buildCalibrationDefenseText(brief = {}, decision = {}) {
  const narrative = decision.narrative || {};
  const ln = brief?.leadershipNarrative || {};
  const protect = brief?.meta?.protectMeAnswer || '';
  const script = ln.meetingScript || [ln.oneParagraph, ln.whatToSay].filter(Boolean).join('\n\n');
  const sentence = commandAnswerSentence(brief) || decision.headline || narrative.headline || '';
  if (protect) return protect;
  if (script) return script;
  if (sentence) {
    const main = narrative.mainIssue || decision.aboveFold?.mainIssue || '';
    return main ? `${sentence}\n\nMain issue: ${main}` : sentence;
  }
  return narrative.summary || decision.summary || 'No governance evidence summary available yet - refresh the brief.';
}

export const buildGovernanceEvidenceText = buildCalibrationDefenseText;

/** First ~3 sentences for drawer previews and tests that still import the legacy name. */
export function buildCalibrationExcerpt(brief = {}, decision = {}) {
  const full = buildCalibrationDefenseText(brief, decision);
  const parts = full.split(/\n\n+/).filter(Boolean);
  const excerpt = parts.slice(0, 2).join('\n\n');
  const truncated = excerpt.length > 420 ? `${excerpt.slice(0, 417).trim()}...` : excerpt;
  return truncated || full.slice(0, 420);
}

export function openPortfolioCalibrationDrawer(decision = {}, cases = []) {
  ensureLegacyBriefSurfacesHydrated();
  const brief = govPage.lastBrief || {};
  const text = buildGovernanceEvidenceText(brief, decision);
  const anchor = decision.anchorProject || '';
  const evidence = decision.evidenceBreakdown || {};
  const required = decision.decisionRequired || {};
  const activeCase = cases.find((c) => c.project === anchor);
  const bodyHtml = `
    <div class="portfolio-calibration-drawer" data-portfolio-calibration-drawer>
      <p class="portfolio-calibration-lead">Use this neutral governance evidence summary to support the portfolio decision.</p>
      <dl class="portfolio-evidence-drawer-facts">
        <div><dt>Decision required</dt><dd>${escapeHtml(required.recommendedAction || 'Confirm PI scope')}</dd></div>
        <div><dt>Owner</dt><dd>${escapeHtml(required.owner || 'Product Owner')}</dd></div>
        <div><dt>Evidence confidence</dt><dd>${escapeHtml(evidence.interpretation || 'Evidence confidence is being calculated')}</dd></div>
      </dl>
      <pre class="portfolio-calibration-script" data-calibration-script>${escapeHtml(text)}</pre>
      <div class="portfolio-calibration-actions">
        <button type="button" class="btn btn-primary btn-compact" data-calibration-copy>Copy evidence summary</button>
        <a class="btn btn-secondary btn-compact" href="/actions?${new URLSearchParams({
          ...(activeCase?.id ? { caseId: activeCase.id } : {}),
          ...(anchor ? { project: anchor } : {}),
          ...(decision.periodKey ? { period: decision.periodKey } : {}),
          tab: 'proof',
        }).toString()}">Open deep evidence in Actions</a>
      </div>
    </div>`;
  const { el } = openRightDrawer({
    title: 'Governance evidence',
    bodyHtml,
    panelClass: 'calibration',
  });
  el.querySelector('[data-calibration-copy]')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    try {
      await writeTextToClipboardWithFallback(text);
      const prior = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = prior; }, 1500);
      try {
        await fetch('/api/governance/adoption-metric', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ metric: 'governanceEvidenceCopied', project: anchor || brief?.projects?.[0] || '' }),
        });
      } catch (_) { /* non-blocking */ }
    } catch (_) {
      btn.textContent = 'Select text above';
    }
  });
}

export const openPortfolioGovernanceEvidenceDrawer = openPortfolioCalibrationDrawer;

/** @deprecated Prefer openPortfolioCalibrationDrawer for two-click value on /governance */
export function openPortfolioActions({ caseId = '', project = '', period = '', tab = 'ready' } = {}) {
  const params = new URLSearchParams();
  if (caseId) params.set('caseId', caseId);
  if (project) params.set('project', project);
  if (period) params.set('period', period);
  if (tab) params.set('tab', tab);
  const qs = params.toString();
  window.location.href = qs ? `/actions?${qs}` : '/actions';
}

export function openPortfolioActionsDrawer(decision = {}, cases = []) {
  openPortfolioCalibrationDrawer(decision, cases);
}
