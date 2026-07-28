/**
 * Evidence-bound sprint flow and servant-leader intervention SSOT.
 * Cycle time is a labelled Jira creation-to-resolution proxy.
 */
import { createHash } from 'crypto';

const DONE = new Set(['done', 'closed', 'resolved']);
const VALUE_WEIGHT = { must: 120, 'must-have': 120, should: 72, could: 24 };
const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value, limit = 500) => String(value || '').trim().slice(0, limit);

function percentile(values, ratio) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] * 10) / 10;
}

function statusCategory(item) {
  const category = text(item?.statusCategoryKey || item?.statusCategory).toLowerCase();
  if (category) return category;
  const status = text(item?.status).toLowerCase();
  if (DONE.has(status)) return 'done';
  return /progress|review|test|blocked/.test(status) ? 'indeterminate' : 'new';
}

function cycleHours(issue) {
  const created = new Date(issue?.fields?.created || issue?.created || '').getTime();
  const resolved = new Date(issue?.fields?.resolutiondate || issue?.resolved || '').getTime();
  if (!Number.isFinite(created) || !Number.isFinite(resolved) || resolved < created) return null;
  return Math.round(((resolved - created) / 3_600_000) * 10) / 10;
}

function issueType(issue) {
  return text(issue?.fields?.issuetype?.name || issue?.issueType || 'Work item', 80);
}

export function buildFlowBaseline(sprintSamples = [], observedAt = new Date().toISOString()) {
  const samples = Array.isArray(sprintSamples) ? sprintSamples.slice(0, 6) : [];
  const completed = samples.flatMap((sample) => (sample?.issues || [])
    .map((issue) => ({ hours: cycleHours(issue), type: issueType(issue) }))
    .filter((row) => row.hours != null));
  const byType = {};
  completed.forEach((row) => {
    if (!byType[row.type]) byType[row.type] = [];
    byType[row.type].push(row.hours);
  });
  const typeBaselines = Object.fromEntries(Object.entries(byType)
    .filter(([, values]) => values.length >= 3)
    .map(([type, values]) => [type, {
      sampleSize: values.length,
      medianHours: percentile(values, 0.5),
      p85Hours: percentile(values, 0.85),
    }]));
  const observations = {};
  samples.forEach((sample) => {
    const counts = {};
    (sample?.issues || []).forEach((issue) => {
      const status = statusCategory({
        status: issue?.fields?.status?.name,
        statusCategoryKey: issue?.fields?.status?.statusCategory?.key,
      });
      if (status !== 'done') counts[status] = (counts[status] || 0) + 1;
    });
    Object.entries(counts).forEach(([status, count]) => {
      if (!observations[status]) observations[status] = [];
      observations[status].push(count);
    });
  });
  const statusObservations = Object.fromEntries(Object.entries(observations).map(([status, counts]) => [status, {
    median: percentile(counts, 0.5),
    p85: percentile(counts, 0.85),
    sampleSize: counts.length,
    source: 'sprint-close-observation',
  }]));
  return {
    version: 'flow-v1',
    source: 'jira-created-to-resolution',
    sourceLabel: 'Creation-to-resolution proxy',
    sprintSampleSize: samples.length,
    sampleSize: completed.length,
    state: completed.length >= 3 ? 'ready' : 'forming',
    medianCycleHours: completed.length >= 3 ? percentile(completed.map((row) => row.hours), 0.5) : null,
    p85CycleHours: completed.length >= 3 ? percentile(completed.map((row) => row.hours), 0.85) : null,
    typeBaselines,
    statusObservations,
    throughput: samples.map((sample) => ({
      sprintId: sample?.sprint?.id || null,
      sprintName: text(sample?.sprint?.name, 120),
      completed: (sample?.issues || []).filter((issue) => cycleHours(issue) != null).length,
    })),
    observedAt,
  };
}

function commitmentFor(story, commitments) {
  const keys = new Set([story?.issueKey, story?.epicKey].map((key) => text(key).toUpperCase()).filter(Boolean));
  const matches = commitments.filter((item) => keys.has(text(item?.issueKey).toUpperCase()));
  return matches.length === 1 ? matches[0] : null;
}

function dependenciesFor(story, commitment) {
  const jira = (story?.issueLinks || [])
    .filter((link) => /block|depend/i.test([
      link?.type?.name,
      link?.type?.inward,
      link?.type?.outward,
      link?.type,
    ].map(text).join(' ')))
    .flatMap((link) => [link?.inwardIssue?.key, link?.outwardIssue?.key, link?.key]);
  const approved = Array.isArray(commitment?.dependencyIssueKeys) ? commitment.dependencyIssueKeys : [];
  return [...new Set([...approved, ...jira].map((key) => text(key).toUpperCase()).filter(Boolean))];
}

function swarmFor(story, daysRemaining) {
  const subtasks = Array.isArray(story?.subtasks) ? story.subtasks : [];
  const open = subtasks.filter((item) => !DONE.has(text(item?.status).toLowerCase()));
  const ready = open.filter((item) => !text(item?.assignee));
  const active = open.filter((item) => text(item?.assignee));
  const target = ready[0] || active.sort((a, b) => n(b?.hoursInStatus) - n(a?.hoursInStatus))[0];
  if (!target) return null;
  const deadline = daysRemaining != null && daysRemaining <= 1 ? 'before today closes' : 'before the next stand-up';
  return {
    parentIssueKey: text(story?.issueKey).toUpperCase(),
    targetSubtaskKey: text(target?.issueKey).toUpperCase(),
    targetSubtaskSummary: text(target?.summary, 160),
    completedCount: subtasks.length - open.length,
    openCount: open.length,
    unassignedReadyCount: ready.length,
    activeCount: active.length,
    question: ready.length
      ? `Who has capacity to swarm ${target.issueKey} (${target.summary || 'the ready subtask'}) ${deadline}?`
      : `What does the squad need to swarm ${target.issueKey} and restore flow ${deadline}?`,
  };
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

export function enhanceFlowIntervention({
  cockpit = {}, stories = [], stuckCandidates = [], flowBaseline = {},
  commitments = [], daysRemaining = null, observedAt = '',
} = {}) {
  const stuckByKey = new Map(stuckCandidates.map((item) => [text(item?.issueKey).toUpperCase(), item]));
  const active = stories.filter((story) => statusCategory(story) !== 'done');
  const statusCounts = active.reduce((result, story) => {
    const status = statusCategory(story);
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const ranked = active.map((story) => {
    const key = text(story?.issueKey).toUpperCase();
    const stuck = stuckByKey.get(key) || {};
    const commitment = commitmentFor(story, commitments);
    const dependencies = dependenciesFor(story, commitment);
    const typed = flowBaseline?.typeBaselines?.[story?.issueType];
    const median = typed?.medianHours ?? flowBaseline?.medianCycleHours ?? null;
    const p85 = typed?.p85Hours ?? flowBaseline?.p85CycleHours ?? null;
    const itemAge = n(story?.ageHours);
    const statusAge = n(stuck?.hoursInStatus ?? story?.hoursInStatus);
    const swarmPlan = swarmFor(story, daysRemaining);
    const ownedSubtasks = (story?.subtasks || []).some((item) => text(item?.assignee));
    const commitmentClass = text(commitment?.commitmentClass).toLowerCase();
    const status = statusCategory(story);
    const historicalWip = flowBaseline?.statusObservations?.[status];
    const wipPressure = historicalWip?.p85 != null && statusCounts[status] > historicalWip.p85;
    let score = VALUE_WEIGHT[commitmentClass] || (commitment ? 45 : 0);
    score += dependencies.length ? 88 : 0;
    score += p85 != null && itemAge > p85 ? 84 : (median != null && itemAge > median ? 48 : 0);
    score += wipPressure ? 36 : 0;
    score += swarmPlan ? 64 : 0;
    score += !text(story?.assignee) && !ownedSubtasks ? 18 : 0;
    score += daysRemaining != null && daysRemaining <= 2 ? 24 : 0;
    const interventionType = swarmPlan ? 'swarm-blocked-work'
      : dependencies.length ? 'protect-dependency'
        : wipPressure ? 'reduce-wip'
          : !commitment ? 'confirm-pi-metadata' : 'restore-acceptance-proof';
    const flowEvidence = {
      currentAgeHours: itemAge || null,
      statusAgeHours: statusAge || null,
      medianCycleHours: median,
      p85CycleHours: p85,
      baselineState: flowBaseline?.state || 'forming',
      baselineSource: flowBaseline?.sourceLabel || 'Baseline forming',
      status,
      currentWip: statusCounts[status] || 0,
      historicalWipP85: historicalWip?.p85 ?? null,
      pressureOnly: wipPressure,
    };
    const valueEvidence = {
      piObjectiveId: text(commitment?.piObjectiveId),
      piObjectiveTitle: text(commitment?.piObjectiveTitle),
      commitmentClass: text(commitment?.commitmentClass),
      businessCase: text(commitment?.businessCase),
      businessValue: text(commitment?.businessValue || commitment?.businessOutcome),
      milestone: text(commitment?.milestone),
      mappingState: commitment ? 'approved' : 'unmapped',
    };
    const impact = valueEvidence.businessValue || valueEvidence.businessCase
      || (dependencies.length ? `${dependencies.join(', ')} may be waiting on this work.` : 'No approved PI value mapping is available.');
    const ask = swarmPlan?.question || (dependencies.length
      ? `Confirm the dependency owner and recovery date for ${key} before the next stand-up.`
      : wipPressure
        ? `What can the squad finish in ${story.status || 'this status'} before pulling more work?`
        : `Confirm how ${key} supports the PI objective before treating it as priority work.`);
    const reason = p85 != null && itemAge > p85
      ? `${key} is ${Math.round(itemAge)}h old versus the team P85 creation-to-resolution proxy of ${Math.round(p85)}h.`
      : flowBaseline?.state === 'forming'
        ? `${key} needs review while the historical flow baseline is still forming.`
        : !commitment
          ? `${key} has no approved PI objective mapping, so its value priority cannot be verified.`
          : `${key} is ranked by approved PI value and current flow evidence.`;
    return {
      issueKey: key, summary: text(story?.summary, 160), status: text(story?.status),
      assignee: text(story?.assignee) || 'Squad swarm', issueUrl: text(story?.issueUrl, 1000),
      hoursInStatus: statusAge, storyPoints: n(story?.storyPoints),
      severity: score >= 150 ? 'High' : score >= 80 ? 'Medium' : 'Low',
      score, reason, businessImpact: impact, recommendedAction: ask,
      ctaLabel: swarmPlan ? 'Review swarm' : 'Review evidence',
      riskTags: [interventionType, ...(p85 != null && itemAge > p85 ? ['cycle-breach'] : []), ...(wipPressure ? ['wip-pressure'] : [])],
      tags: [valueEvidence.piObjectiveTitle || valueEvidence.piObjectiveId || 'PI objective unmapped', dependencies.length ? `${dependencies.length} dependencies` : 'No verified dependency'],
      interventionType, flowEvidence, valueEvidence,
      dependencyEvidence: { issueKeys: dependencies, source: dependencies.length ? 'approved-baseline-or-jira-link' : 'none' },
      swarmPlan, diagnosisConfidence: commitment || dependencies.length ? 0.92 : 0.74,
      sourceFreshness: observedAt, requiresHumanConfirmation: true,
    };
  }).sort((a, b) => b.score - a.score || b.storyPoints - a.storyPoints || a.issueKey.localeCompare(b.issueKey));
  const topRisks = ranked.slice(0, 3);
  const selected = topRisks[0];
  const nextBestAction = selected ? {
    ...selected,
    nextAction: selected.recommendedAction,
    interventionHash: hash({ key: selected.issueKey, type: selected.interventionType, flow: selected.flowEvidence, value: selected.valueEvidence }),
  } : cockpit.nextBestAction;
  return { ...cockpit, topRisks, nextBestAction, flowBaseline };
}
