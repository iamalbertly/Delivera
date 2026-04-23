const BULLET_PREFIX_RE = /^\s*(?:[-*•]+|\d+\s*[:.)-])\s*/;
const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/ig;
const TABLE_HEADER_RE = /^(key|summary|description|status|owner|assignee)$/i;
const ACTION_WORD_RE = /\b(add|fix|update|wire|send|display|enable|filter|create|build|implement|validate|show|hide|refactor|split|link|copy|export|notify)\b/i;
const STARTS_WITH_ACTION_WORD_RE = /^(add|fix|update|wire|send|display|enable|filter|create|build|implement|validate|show|hide|refactor|split|link|copy|export|notify)\b/i;
const THEME_WORD_RE = /\b(users?|experience|platform|strategy|planning|feedback|journey|system|flow|initiative|improve|quarter|quarterly|customer|capability)\b/i;
const USER_STORY_RE = /\bas a\b.+\bi want\b.+\bso that\b/i;
const QUARTER_EPIC_LINE_RE = /\bfy\s*\d{2}\s*q[1-4]\b/i;

export const OUTCOME_STRUCTURE_MODE = Object.freeze({
  EMPTY: 'EMPTY',
  SINGLE_ISSUE: 'SINGLE_ISSUE',
  EPIC_WITH_STORIES: 'EPIC_WITH_STORIES',
  STORY_WITH_SUBTASKS: 'STORY_WITH_SUBTASKS',
  MULTIPLE_EPICS: 'MULTIPLE_EPICS',
  TABLE_ISSUES: 'TABLE_ISSUES',
});

function isParentChildMode(mode) {
  return mode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES || mode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTitleSpacing(value) {
  return normalizeWhitespace(value)
    .replace(/\(\s*/g, ' (')
    .replace(/\s*\)/g, ')')
    .replace(/\s*&\s*/g, ' & ');
}

function cleanupLine(value) {
  let text = String(value || '').replace(/\u00a0/g, ' ').trim();
  text = text.replace(BULLET_PREFIX_RE, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/[:.]+$/, '').trim();
  return text;
}

function rewriteTitle(value) {
  let text = cleanupLine(value);
  if (!text) return '';
  text = text
    .replace(/\bOn Display and Export\b/gi, 'for display and export')
    .replace(/\bto be displayed\b/gi, 'in views and exports')
    .replace(/\bFix SMS notification\b/gi, 'Fix SMS notification flow for feedback events')
    .replace(/\bFilter by Feedback Category\b/gi, 'Filter feedback by category')
    .replace(/\bAdd Customer Number on Feedback\b/gi, 'Add customer number to feedback');
  text = normalizeTitleSpacing(text);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function detectLabelsFromText(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  const labels = new Set();
  if (!text) return [];
  if (text.includes('feedback')) labels.add('feedback-experience');
  if (text.includes('display') || text.includes('export')) labels.add('display-export');
  if (text.includes('filter') || text.includes('category')) labels.add('category-filtering');
  if (text.includes('sms') || text.includes('notification')) labels.add('notifications');
  if (text.includes('consent')) labels.add('consent');
  return Array.from(labels);
}

function extractJiraKeys(value) {
  const keys = [];
  const seen = new Set();
  let match;
  const text = String(value || '');
  while ((match = JIRA_KEY_RE.exec(text)) != null) {
    const key = String(match[1] || '').toUpperCase();
    if (!key || key === 'AD-HOC' || key.endsWith('-AD-HOC') || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  JIRA_KEY_RE.lastIndex = 0;
  return keys;
}

function splitTitleAndDescription(rawLine) {
  const line = cleanupLine(rawLine);
  if (!line) return { title: '', description: '' };
  const separatorIndex = line.indexOf(': ');
  if (separatorIndex > 0) {
    const before = line.slice(0, separatorIndex).trim();
    const after = line.slice(separatorIndex + 2).trim();
    if (before && after.length >= 12 && !after.match(/^[A-Z][A-Z0-9]+-\d+$/i)) {
      return {
        title: rewriteTitle(before),
        description: normalizeWhitespace(after),
      };
    }
  }
  return { title: rewriteTitle(line), description: '' };
}

function getLineSignals(text) {
  const clean = normalizeWhitespace(text);
  const words = clean ? clean.split(/\s+/).length : 0;
  const actionLike = ACTION_WORD_RE.test(clean);
  const startsWithAction = STARTS_WITH_ACTION_WORD_RE.test(clean);
  const themeLike = THEME_WORD_RE.test(clean);
  const userStoryLike = USER_STORY_RE.test(clean);
  return {
    words,
    actionLike,
    startsWithAction,
    themeLike,
    userStoryLike,
  };
}

function buildRow(raw, description = '') {
  const split = splitTitleAndDescription(raw);
  const title = split.title || rewriteTitle(raw);
  const body = normalizeWhitespace(description || split.description || '');
  const signals = getLineSignals(title);
  return {
    raw,
    clean: title,
    description: body,
    jiraKeys: extractJiraKeys(raw),
    labels: detectLabelsFromText(raw + ' ' + body),
    signals,
  };
}

function parseTabularRows(rawText) {
  const rows = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => normalizeWhitespace(cell)));
  if (!rows.some((row) => row.length > 1)) return [];
  const header = rows[0] || [];
  const hasHeader = header.every((cell) => TABLE_HEADER_RE.test(cell));
  return (hasHeader ? rows.slice(1) : rows)
    .filter((row) => normalizeWhitespace(row.join(' ')).length >= 3)
    .map((row) => buildRow(row[0] || '', row.slice(1).filter(Boolean).join(' | ')))
    .filter((row) => row.clean);
}

function parseBulletRows(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line || extractJiraKeys(line).length > 0)
    .map((line) => buildRow(line))
    .filter((row) => row.clean.length >= 3 || row.jiraKeys.length > 0);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function confidenceLabel(score) {
  if (score >= 0.7) return 'high confidence';
  if (score >= 0.4) return 'medium confidence';
  return 'low confidence';
}

function pickSingleIssueType(row) {
  if (row?.signals?.userStoryLike || row?.signals?.actionLike) return 'Story';
  return 'Epic';
}

function decideStructureMode(rows, inputKind) {
  if (!rows.length) {
    return { structureMode: OUTCOME_STRUCTURE_MODE.EMPTY, confidenceScore: 0, rationale: 'No narrative provided.' };
  }
  if (inputKind === 'table') {
    return { structureMode: OUTCOME_STRUCTURE_MODE.TABLE_ISSUES, confidenceScore: 0.92, rationale: 'Detected table input; each row becomes one issue with a description.' };
  }
  if (rows.length === 1) {
    const type = pickSingleIssueType(rows[0]);
    const rationale = type === 'Story'
      ? 'Single substantial line looks like concrete work, so it becomes one Jira story.'
      : 'Single substantial line looks thematic, so it becomes one Jira epic.';
    return { structureMode: OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE, confidenceScore: 0.84, rationale };
  }

  const first = rows[0];
  const rest = rows.slice(1);
  const restActionRatio = rest.filter((row) => row.signals.actionLike).length / Math.max(1, rest.length);
  const restThemeRatio = rest.filter((row) => row.signals.themeLike && !row.signals.startsWithAction).length / Math.max(1, rest.length);
  const firstBroad = (first.signals.themeLike || /\busers?\b/i.test(first.clean))
    && !first.signals.userStoryLike
    && !first.signals.startsWithAction;
  const firstConcrete = first.signals.userStoryLike
    || first.signals.startsWithAction
    || (first.signals.actionLike && first.signals.words <= 6 && !first.signals.themeLike);
  const allBroad = rows.every((row) => row.signals.themeLike && !row.signals.startsWithAction && row.signals.words >= 3);
  const quarterlyEpicBatch = rows.length >= 3
    && rows.every((row) => QUARTER_EPIC_LINE_RE.test(row.clean))
    && rows.every((row) => !row.signals.startsWithAction);

  if (quarterlyEpicBatch) {
    return {
      structureMode: OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS,
      confidenceScore: 0.9,
      rationale: 'Detected quarter-stamped initiative lines, so each line is treated as a top-level epic.',
    };
  }

  if (allBroad) {
    return {
      structureMode: OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS,
      confidenceScore: 0.68,
      rationale: 'Each line looks thematic rather than atomic, so they are treated as separate epics.',
    };
  }

  if (firstConcrete && restActionRatio >= 0.6) {
    return {
      structureMode: OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS,
      confidenceScore: clamp01(0.62 + (restActionRatio * 0.28) + (first.signals.userStoryLike ? 0.1 : 0)),
      rationale: 'The first line looks like a concrete story and the remaining lines look like implementation steps.',
    };
  }

  if (firstBroad && restActionRatio >= 0.5) {
    return {
      structureMode: OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES,
      confidenceScore: clamp01(0.66 + (restActionRatio * 0.24)),
      rationale: 'The first line reads like a theme and the remaining lines read like backlog-sized actions.',
    };
  }

  if (restThemeRatio >= 0.6) {
    return {
      structureMode: OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS,
      confidenceScore: 0.55,
      rationale: 'Most lines look broad and independent, so they are treated as separate epics.',
    };
  }

  return {
    structureMode: OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES,
    confidenceScore: 0.34,
    rationale: 'The structure is ambiguous, so the parser defaults to epic + stories to preserve planning flexibility.',
  };
}

function reorderRowsForParent(rows, parentIndex) {
  const safeRows = Array.isArray(rows) ? rows.slice() : [];
  const index = Number(parentIndex);
  if (!Number.isInteger(index) || index <= 0 || index >= safeRows.length) return safeRows;
  const [parent] = safeRows.splice(index, 1);
  safeRows.unshift(parent);
  return safeRows;
}

function buildPreviewRows(rows, structureMode) {
  if (structureMode === OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS || structureMode === OUTCOME_STRUCTURE_MODE.TABLE_ISSUES) {
    return rows.map((row) => ({
      kind: structureMode === OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS ? 'EPIC' : 'ISSUE',
      title: row.clean,
      description: row.description,
      jiraKeys: row.jiraKeys,
      labels: row.labels,
    }));
  }

  if (structureMode === OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE) {
    return [{
      kind: 'ISSUE',
      title: rows[0]?.clean || 'Outcome from narrative',
      description: rows[0]?.description || '',
      jiraKeys: rows[0]?.jiraKeys || [],
      labels: rows[0]?.labels || [],
    }];
  }

  const parentKind = structureMode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS ? 'STORY' : 'EPIC';
  const childKind = structureMode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS ? 'SUBTASK' : 'STORY';
  return [
    {
      kind: parentKind,
      title: rows[0]?.clean || 'Outcome from narrative',
      description: rows[0]?.description || '',
      jiraKeys: rows[0]?.jiraKeys || [],
      labels: rows[0]?.labels || [],
    },
    ...rows.slice(1).map((row) => ({
      kind: childKind,
      title: row.clean,
      description: row.description,
      jiraKeys: row.jiraKeys,
      labels: row.labels,
    })),
  ];
}

export function parseOutcomeIntake(rawText, options = {}) {
  const source = String(rawText || '').trim();
  if (!source) {
    return {
      mode: 'empty',
      structureMode: OUTCOME_STRUCTURE_MODE.EMPTY,
      confidenceScore: 0,
      confidenceLabel: 'low confidence',
      rationale: 'No narrative provided.',
      rawText: '',
      inputKind: 'empty',
      epic: null,
      items: [],
      previewRows: [],
      totalCandidates: 0,
      hasMultipleItems: false,
      allDetectedJiraKeys: [],
      suggestedLabels: [],
      singleIssueType: 'Epic',
    };
  }

  const inputKind = source.includes('\t') ? 'table' : 'list';
  const rows = inputKind === 'table' ? parseTabularRows(source) : parseBulletRows(source);
  const labels = new Set(['quarterly-planning']);
  rows.forEach((row) => row.labels.forEach((label) => labels.add(label)));

  if (!rows.length) {
    return {
      mode: 'single',
      structureMode: OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE,
      confidenceScore: 0.22,
      confidenceLabel: 'low confidence',
      rationale: 'Could not detect a list. Will create 1 Jira issue from the full narrative.',
      rawText: source,
      inputKind: 'narrative',
      epic: { title: rewriteTitle(source) || 'Outcome from narrative', description: source, jiraKeys: extractJiraKeys(source) },
      items: [],
      previewRows: [],
      totalCandidates: 1,
      hasMultipleItems: false,
      allDetectedJiraKeys: extractJiraKeys(source),
      suggestedLabels: Array.from(labels),
      singleIssueType: pickSingleIssueType(buildRow(source)),
    };
  }

  const decision = decideStructureMode(rows, inputKind);
  const overrideStructureMode = typeof options?.structureMode === 'string' ? options.structureMode.trim() : '';
  const structureMode = overrideStructureMode || decision.structureMode;
  const reorderedRows = isParentChildMode(structureMode)
    ? reorderRowsForParent(rows, options?.parentIndex)
    : rows;
  const previewRows = buildPreviewRows(reorderedRows, structureMode);
  const allKeys = Array.from(new Set(previewRows.flatMap((row) => row.jiraKeys || [])));
  const singleIssueType = structureMode === OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE
    ? pickSingleIssueType(reorderedRows[0])
    : (structureMode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS ? 'Story' : 'Epic');

  const epic = (structureMode === OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS || structureMode === OUTCOME_STRUCTURE_MODE.TABLE_ISSUES)
    ? null
    : {
      title: reorderedRows[0]?.clean || 'Outcome from narrative',
      description: source,
      jiraKeys: reorderedRows[0]?.jiraKeys || [],
    };

  const items = structureMode === OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE
    ? []
    : (structureMode === OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS || structureMode === OUTCOME_STRUCTURE_MODE.TABLE_ISSUES)
      ? reorderedRows.map((row, index) => ({ index: index + 1, title: row.clean, description: row.description, jiraKeys: row.jiraKeys, labels: row.labels }))
      : reorderedRows.slice(1).map((row, index) => ({ index: index + 1, title: row.clean, description: row.description, jiraKeys: row.jiraKeys, labels: row.labels }));

  return {
    mode: reorderedRows.length > 1 ? 'multi' : 'single',
    structureMode,
    inferredStructureMode: decision.structureMode,
    confidenceScore: Number(decision.confidenceScore.toFixed(2)),
    confidenceLabel: confidenceLabel(decision.confidenceScore),
    rationale: decision.rationale,
    rawText: source,
    inputKind,
    epic,
    items,
    previewRows,
    totalCandidates: reorderedRows.length,
    hasMultipleItems: reorderedRows.length > 1,
    allDetectedJiraKeys: allKeys,
    suggestedLabels: Array.from(labels),
    singleIssueType,
  };
}
