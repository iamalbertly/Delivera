/**
 * Enrich mocked portfolio-decision payloads with deterministic priorityBrief (Node/test only).
 */
import { buildPortfolioDecision } from '../lib/Delivera-Governance-PortfolioDecision-01SSOT.js';

export function enrichDecisionPayload(brief = {}, partial = {}, cases = []) {
  const built = buildPortfolioDecision({
    brief,
    anchorProject: partial.anchorProject || brief.projects?.[0] || 'SD',
    compareProjects: partial.compareProjects || (brief.projects || []).slice(1),
    cases: partial.cases || cases,
    baselineMissing: partial.baselineMissing ?? Boolean(brief.meta?.setupGaps?.some((g) => g.action === 'set-baseline')),
    partialSquads: partial.partialSquads ?? 0,
  });
  return {
    ok: true,
    decision: { ...built, ...partial, priorityBrief: built.priorityBrief, portfolioJudgment: built.portfolioJudgment, commitmentRows: built.commitmentRows, sponsorBriefMarkdown: built.sponsorBriefMarkdown, interventionSummary: built.interventionSummary },
    comparison: partial.comparison || { cards: [] },
    cases: partial.cases || cases,
    meta: partial.meta || { cached: false },
  };
}
