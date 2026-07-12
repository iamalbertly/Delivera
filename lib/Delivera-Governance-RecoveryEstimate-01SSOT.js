/**
 * SSOT: Honest recovery judgment — capacity translated to recoverability.
 */
export const RECOVERY_OUTLOOK = Object.freeze({
  RECOVERABLE: 'recoverable',
  PARTLY: 'partly',
  UNLIKELY: 'unlikely',
  UNKNOWN: 'unknown',
});

export const CONFIDENCE_BAND = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function estimateRecovery({
  unsupportedCount = 0,
  offPlanHours = 0,
  sprintPulse = {},
  timebox = {},
  blockedCount = 0,
} = {}) {
  const gaps = Math.max(0, asNum(unsupportedCount));
  if (gaps <= 0) {
    return { outlook: RECOVERY_OUTLOOK.RECOVERABLE, confidence: CONFIDENCE_BAND.HIGH, basis: 'No unsupported promises remain', recoverableCount: 0 };
  }

  const committed = asNum(sprintPulse.committed, 0);
  const done = asNum(sprintPulse.done, 0);
  const remainingHours = Math.max(0, asNum(offPlanHours) > 0 ? committed * 4 - asNum(offPlanHours) : committed * 2);
  const totalDays = asNum(timebox.totalDays, 90);
  const elapsedDays = asNum(timebox.elapsedDays, Math.round(totalDays / 2));
  const timeRemainingPct = totalDays > 0 ? Math.max(0, (totalDays - elapsedDays) / totalDays) : 0.5;
  const velocity = committed > 0 ? done / committed : 0;

  if (blockedCount >= gaps) {
    return {
      outlook: RECOVERY_OUTLOOK.UNLIKELY,
      confidence: CONFIDENCE_BAND.HIGH,
      basis: `${blockedCount} blocked item${blockedCount === 1 ? '' : 's'} undermine recovery`,
      recoverableCount: 0,
      remainingHours,
    };
  }

  if (timeRemainingPct < 0.15) {
    return {
      outlook: RECOVERY_OUTLOOK.UNLIKELY,
      confidence: CONFIDENCE_BAND.MEDIUM,
      basis: 'Quarter time nearly elapsed',
      recoverableCount: 0,
      remainingHours,
    };
  }

  const hoursPerGap = gaps > 0 ? remainingHours / gaps : remainingHours;
  let outlook = RECOVERY_OUTLOOK.UNKNOWN;
  let confidence = CONFIDENCE_BAND.LOW;
  let recoverableCount = 0;
  let basis = 'Cannot estimate without capacity signal';

  if (remainingHours <= 0 || committed <= 0) {
    outlook = RECOVERY_OUTLOOK.UNKNOWN;
    confidence = CONFIDENCE_BAND.LOW;
    basis = 'Cannot estimate without capacity signal';
  } else if (hoursPerGap >= 20 && velocity >= 0.35) {
    outlook = RECOVERY_OUTLOOK.RECOVERABLE;
    confidence = CONFIDENCE_BAND.MEDIUM;
    recoverableCount = gaps;
    basis = `${Math.round(remainingHours)} hours remain with steady delivery`;
  } else if (hoursPerGap >= 10) {
    outlook = RECOVERY_OUTLOOK.PARTLY;
    confidence = CONFIDENCE_BAND.MEDIUM;
    recoverableCount = Math.max(1, gaps - 1);
    basis = `${Math.round(remainingHours)} hours remain · one of ${gaps} gap${gaps === 1 ? '' : 's'} may still be recoverable`;
  } else {
    outlook = RECOVERY_OUTLOOK.UNLIKELY;
    confidence = CONFIDENCE_BAND.MEDIUM;
    recoverableCount = 0;
    basis = `${Math.round(remainingHours)} hours remain · recovery unlikely for all gaps`;
  }

  return { outlook, confidence, basis, recoverableCount, remainingHours };
}

export function recoverySummaryLine(estimate = {}) {
  if (!estimate || estimate.outlook === RECOVERY_OUTLOOK.UNKNOWN) {
    return 'Recovery cannot be estimated from current capacity';
  }
  const conf = estimate.confidence === CONFIDENCE_BAND.HIGH ? 'High'
    : estimate.confidence === CONFIDENCE_BAND.MEDIUM ? 'Medium' : 'Low';
  return `${estimate.basis} · ${conf} confidence`;
}
