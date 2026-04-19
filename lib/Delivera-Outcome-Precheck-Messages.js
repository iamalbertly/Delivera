/**
 * SSOT precheck copy for outcome draft (non-blocking hints).
 * Values: Customer clarity, Simplicity (one line), Speed (no wizard).
 */

export const OUTCOME_PRECHECK_KEYS = Object.freeze({
  MIXED_NOTES: 'mixed_notes',
  SUPPORT_BIAS: 'support_bias',
  SHORT_INPUT: 'short_input',
  TRUNCATED: 'truncated',
});

const MESSAGES = {
  [OUTCOME_PRECHECK_KEYS.MIXED_NOTES]: 'Mixed notes detected — drafting conservatively with fewer items.',
  [OUTCOME_PRECHECK_KEYS.SUPPORT_BIAS]: 'Looks like support or maintenance work — we will prefer the quarter support epic when one exists.',
  [OUTCOME_PRECHECK_KEYS.SHORT_INPUT]: 'Very short input — add a system code or quarter label for stronger matching (optional).',
  [OUTCOME_PRECHECK_KEYS.TRUNCATED]: 'Input was truncated for speed — paste a shorter note or split into two passes.',
};

const SUPPORT_WORDS = /\b(support|defect|downstream|maintenance|adhoc|hotfix|bug|fix|investigation)\b/i;
const PLANNED_WORDS = /\b(feature|epic|initiative|q[1-4]|fy\d{2}|penetration|dashboard|release)\b/i;

export function detectInputSignals(rawText) {
  const text = String(rawText || '').trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const mixed = lines.length >= 2 && SUPPORT_WORDS.test(text) && PLANNED_WORDS.test(text);
  const supportBias = SUPPORT_WORDS.test(text) && !mixed;
  const short = wordCount > 0 && wordCount < 8 && text.length < 120;
  return { mixed, supportBias, short, wordCount, lineCount: lines.length };
}

/** Returns at most one primary precheck { key, message } for the UI strip */
export function pickPrecheckMessage(rawText, inputMode = 'mixed') {
  const MAX_CHARS = 10000;
  const text = String(rawText || '');
  if (text.length > MAX_CHARS) {
    return { key: OUTCOME_PRECHECK_KEYS.TRUNCATED, message: MESSAGES[OUTCOME_PRECHECK_KEYS.TRUNCATED] };
  }
  const sig = detectInputSignals(text);
  if (inputMode === 'support' || (sig.supportBias && inputMode !== 'quarterly')) {
    return { key: OUTCOME_PRECHECK_KEYS.SUPPORT_BIAS, message: MESSAGES[OUTCOME_PRECHECK_KEYS.SUPPORT_BIAS] };
  }
  if (sig.mixed || (sig.lineCount >= 3 && sig.wordCount > 40)) {
    return { key: OUTCOME_PRECHECK_KEYS.MIXED_NOTES, message: MESSAGES[OUTCOME_PRECHECK_KEYS.MIXED_NOTES] };
  }
  if (sig.short) {
    return { key: OUTCOME_PRECHECK_KEYS.SHORT_INPUT, message: MESSAGES[OUTCOME_PRECHECK_KEYS.SHORT_INPUT] };
  }
  return null;
}

export function getPrecheckMessageByKey(key) {
  if (!key || !MESSAGES[key]) return '';
  return MESSAGES[key];
}
