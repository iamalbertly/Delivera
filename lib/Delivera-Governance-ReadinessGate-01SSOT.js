/**
 * SSOT: Per-squad governance readiness stages (gates before plan-backed scoring).
 *
 * Stage 0 — no PI slide for this squad
 * Stage 1 — slide on file, epic(s) not in Jira
 * Stage 2 — epics in Jira, no board stories / not planned
 * Stage 3 — plan-backed delivery scoring allowed
 */
import { BASELINE_VERDICTS } from './Delivera-Governance-PIBaseline-02Compare.js';
import { isBaselineMissingForProject } from './Delivera-Governance-PortfolioDecision-01SSOT.js';

export const READINESS_STAGES = Object.freeze({
  UPLOAD_SLIDE: 0,
  CREATE_JIRA_EPICS: 1,
  PLAN_STORIES: 2,
  SCORE_DELIVERY: 3,
});

function issueProject(key = '') {
  const k = String(key || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9]+-\d+$/.test(k) ? k.split('-')[0] : '';
}

function itemsForProject(brief = {}, projectKey = '') {
  const pk = String(projectKey || '').trim().toUpperCase();
  const byProject = brief?.baselineComparisonByProject?.[pk];
  if (byProject?.items?.length) return byProject.items;
  const legacy = brief?.baselineComparison?.items || [];
  return legacy.filter((item) => {
    const squad = String(item.squad || '').trim().toUpperCase();
    const issuePk = issueProject(item.issueKey);
    return squad === pk || issuePk === pk;
  });
}

/**
 * @returns {{ stage: number, cta: string, reason: string, label: string, action: string, gated: boolean }}
 */
export function resolveSquadReadinessStage({
  projectKey = '',
  brief = {},
  baselineMode = 'pi-baseline',
  squadName = '',
} = {}) {
  const pk = String(projectKey || '').trim().toUpperCase();
  const name = squadName || pk || 'this squad';
  const readiness = brief?.meta?.baselineReadinessByProject?.[pk];
  const baselineMissing = readiness
    ? Boolean(readiness.missing || !readiness.hasBaseline)
    : isBaselineMissingForProject(brief, pk, baselineMode);

  if (baselineMissing) {
    return {
      stage: READINESS_STAGES.UPLOAD_SLIDE,
      gated: true,
      label: 'Upload PI slide to judge plan',
      reason: `No quarter PI slide on file for ${name}`,
      cta: `Upload ${name} PI slide`,
      action: 'open-alignment-studio',
      wizardMode: 'slide',
    };
  }

  const items = itemsForProject(brief, pk);
  const committed = items.filter((i) => i.verdict !== BASELINE_VERDICTS.ADDED_AFTER_BASELINE);
  const missingInJira = committed.filter((i) => {
    const lifecycle = String(i?.epicActivity?.lifecycle || '').toLowerCase();
    const verdict = String(i.verdict || '').toLowerCase();
    return !i.issueKey || lifecycle === 'missing' || (verdict === BASELINE_VERDICTS.REMOVED && lifecycle === 'missing');
  });
  if (committed.length > 0 && missingInJira.length > 0) {
    return {
      stage: READINESS_STAGES.CREATE_JIRA_EPICS,
      gated: true,
      label: 'On PI slide · not in Jira yet',
      reason: `${missingInJira.length} commitment${missingInJira.length === 1 ? '' : 's'} on the slide need Jira epics under ${name}`,
      cta: 'Create epics from slide',
      action: 'open-alignment-studio',
      wizardMode: 'create-epics',
    };
  }

  const notPlanned = committed.filter((i) => {
    const verdict = String(i.verdict || '').toLowerCase();
    const lifecycle = String(i?.epicActivity?.lifecycle || '').toLowerCase();
    return verdict === BASELINE_VERDICTS.NOT_PLANNED
      || lifecycle === 'jira-only'
      || lifecycle === 'not-started';
  });
  if (notPlanned.length > 0) {
    return {
      stage: READINESS_STAGES.PLAN_STORIES,
      gated: true,
      label: 'Committed · not planned yet',
      reason: `${notPlanned.length} epic${notPlanned.length === 1 ? '' : 's'} in Jira still have no stories on the selected boards`,
      cta: 'Nudge squad to plan stories',
      action: 'nudge-plan-stories',
      wizardMode: null,
      notPlannedKeys: notPlanned.map((i) => String(i.issueKey || '').toUpperCase()).filter(Boolean),
    };
  }

  return {
    stage: READINESS_STAGES.SCORE_DELIVERY,
    gated: false,
    label: 'Plan-backed',
    reason: 'Slide, Jira epics, and board stories are in place for scoring',
    cta: '',
    action: '',
    wizardMode: null,
  };
}

export function summarizeReadinessAcrossSquads(stages = []) {
  const list = Array.isArray(stages) ? stages : [];
  const total = list.length;
  const planBacked = list.filter((s) => s.stage >= READINESS_STAGES.SCORE_DELIVERY).length;
  const awaitingJira = list.filter((s) => s.stage === READINESS_STAGES.CREATE_JIRA_EPICS).length;
  const awaitingPlan = list.filter((s) => s.stage === READINESS_STAGES.PLAN_STORIES).length;
  const awaitingSlide = list.filter((s) => s.stage === READINESS_STAGES.UPLOAD_SLIDE).length;
  const readyToScore = planBacked;
  const parts = [];
  if (total) parts.push(`${planBacked}/${total} plan-backed`);
  if (awaitingSlide) parts.push(`${awaitingSlide} awaiting slide`);
  if (awaitingJira) parts.push(`${awaitingJira} awaiting Jira epics`);
  if (awaitingPlan) parts.push(`${awaitingPlan} awaiting story planning`);
  if (readyToScore && !awaitingSlide && !awaitingJira && !awaitingPlan) {
    parts.push(`${readyToScore} ready to score`);
  } else if (readyToScore) {
    parts.push(`${readyToScore} ready to score`);
  }
  return {
    total,
    planBacked,
    awaitingSlide,
    awaitingJira,
    awaitingPlan,
    readyToScore,
    line: parts.join(' · ') || 'No squads in scope',
  };
}
