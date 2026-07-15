/**
 * SSOT: Portfolio cadence pack — last sprint / idle / quarter delivery (no new drawers).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { quarterDayLabel } from './Delivera-App-Portfolio-Signal-01Render-UI.js';
import { maxStaleHoursFromBrief, resolveBaselineEntryPoint, deriveTrustChipLabel } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

function staleLabelFromBrief(brief = {}) {
  const h = maxStaleHoursFromBrief(brief);
  if (h <= 0) return '';
  // Cap staleness at the sprint's actual duration — a sprint that started
  // 13d ago cannot be "48d stale". The maxStaleHours measures the oldest
  // stale issue's age, not the sprint's staleness. (Audit 2026-07-15:
  // cadence chip showed "48d stale" for a 13-day-old sprint.)
  const selected = (brief?.projects || []).map((p) => String(p).toUpperCase());
  const squad = (brief?.squadInsights || []).find((s) => selected.includes(String(s.projectKey || '').toUpperCase()))
    || brief?.squadInsights?.[0];
  const daysElapsed = Number(squad?.sprintPulse?.daysElapsedCalendar) || Number(squad?.sprintPulse?.daysElapsed) || 0;
  let cappedH = h;
  if (daysElapsed > 0) {
    const sprintAgeH = daysElapsed * 24;
    if (sprintAgeH > 0 && sprintAgeH < h) cappedH = sprintAgeH;
  }
  if (cappedH < 24) return `${Math.round(cappedH)}h stale`;
  return `${Math.round(cappedH / 24)}d stale`;
}

function sprintCadencePart(c, brief = {}) {
  if (c.status === 'stalled') {
    // Stalled sprint: never say "Sprint open" — show the stall duration honestly.
    const stale = staleLabelFromBrief(brief);
    const days = c.staleDays || (stale ? parseInt(stale, 10) : 0);
    return stale
      ? `${COPY.cadenceActiveStalled} · ${stale}`
      : `${COPY.cadenceActiveStalled} · ${days}d since movement`;
  }
  if (c.status === 'active') {
    if (c.movementHealth === 'blocked') {
      const stale = staleLabelFromBrief(brief);
      const pct = c.sprintCommitted > 0 ? Math.round((c.sprintDone / c.sprintCommitted) * 100) : 0;
      // Use explicit template instead of fragile .replace('0%', ...) substitution.
      return stale
        ? `${COPY.cadenceActiveNoMovement} · ${stale}`
        : `Sprint open · ${pct}% movement`;
    }
    if (c.movementHealth === 'stalled') {
      const stale = staleLabelFromBrief(brief);
      return stale ? `${COPY.cadenceActiveStalled} · ${stale}` : COPY.cadenceActiveStalled;
    }
    if (c.sprintCommitted > 0) {
      return COPY.cadenceActiveProgress
        .replace('{done}', String(c.sprintDone))
        .replace('{committed}', String(c.sprintCommitted));
    }
    return COPY.cadenceActiveSprint.replace('{name}', c.sprintName || 'Active sprint');
  }
  if (c.status === 'ended' && c.daysSinceEnd != null) {
    // BONUS EDGE CASE: If the last sprint ended >30 days ago, suppress any
    // cadence language and show a clear "no active sprint" warning. Users
    // were seeing "okay delivery cadence" for squads that haven't sprinted
    // in a month — a trust-destroying contradiction.
    if (c.daysSinceEnd > 30) {
      return `⚠ No active sprint — last sprint ${c.daysSinceEnd}d ago`;
    }
    return COPY.cadenceSprintEnded
      .replace('{name}', c.sprintName || 'Last sprint')
      .replace('{days}', String(c.daysSinceEnd));
  }
  return COPY.cadenceNoSprint;
}

function daysAgo(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

/**
 * Compute the next Vodacom fiscal quarter label from a current quarter string.
 * e.g. "FY26 Q2" → "FY26 Q3", "FY26 Q4" → "FY27 Q1"
 */
function nextQuarterLabel(periodKey = '') {
  const m = String(periodKey).match(/FY(\d{2,4})\s*Q([1-4])/i);
  if (!m) return 'next quarter';
  let fy = parseInt(m[1], 10);
  let q = parseInt(m[2], 10);
  q += 1;
  if (q > 4) { q = 1; fy += 1; }
  return `FY${String(fy).padStart(2,'0')} Q${q}`;
}

function deriveMovementHealth(brief = {}, cadenceStatus = 'idle') {
  if (cadenceStatus === 'none' || cadenceStatus === 'idle' || cadenceStatus === 'ended' || cadenceStatus === 'stalled') {
    return cadenceStatus === 'stalled' ? 'stalled' : 'dormant';
  }
  const selected = (brief?.projects || []).map((p) => String(p).toUpperCase());
  const squad = (brief?.squadInsights || []).find((s) => selected.includes(String(s.projectKey || '').toUpperCase()))
    || brief?.squadInsights?.[0]
    || null;
  const committed = Number(squad?.sprintPulse?.committed) || 0;
  const done = Number(squad?.sprintPulse?.done) || 0;
  const ratio = committed > 0 ? done / committed : null;
  const verdict = String(brief?.executiveView?.verdictTier || '').toLowerCase();
  if (verdict === 'blocked' || (ratio != null && ratio < 0.15)) return 'blocked';
  if (ratio != null && ratio < 0.4) return 'stalled';
  return 'healthy';
}

/**
 * Derive cadence from brief.meta.scopeIntelligence + boardSummaries (existing SSOT only).
 * @param {object} brief
 */
export function buildCadencePackState(brief = {}) {
  const cards = brief?.meta?.scopeIntelligence?.cards || [];
  const selected = (brief?.projects || []).map((p) => String(p).toUpperCase());
  const focus = cards.find((c) => selected.includes(String(c.projectKey || '').toUpperCase()) && c.isSelected)
    || cards.find((c) => selected.includes(String(c.projectKey || '').toUpperCase()))
    || cards[0]
    || null;
  const sprint = focus?.sprint || 'none';
  const cadenceMeta = brief?.meta?.cadence || focus?.cadence || {};
  const lastEnd = cadenceMeta.lastSprintEnd || cadenceMeta.latestEnd || null;
  const lastName = cadenceMeta.lastSprintName || cadenceMeta.sprintName || '';
  const ago = daysAgo(lastEnd);
  // Stale-detection from brief: an "active" sprint with staleHours >= 7d and 0 movement is stalled.
  const staleHours = Number(cadenceMeta.staleHours || brief?.meta?.sprintStaleHours || 0);
  const staleDays = Number.isFinite(staleHours) && staleHours > 0 ? staleHours / 24 : 0;
  const movementPct = Number(cadenceMeta.movementPct ?? brief?.meta?.sprintMovementPct ?? -1);
  const hasNoMovement = movementPct === 0;
  const isStalledActive = sprint === 'active' && staleDays >= 7 && hasNoMovement;
  let status = 'idle';
  if (isStalledActive) status = 'stalled';
  else if (sprint === 'active') status = 'active';
  else if (sprint === 'closed' || ago != null) status = 'ended';
  else if (sprint === 'none') status = 'none';
  const deliveryPct = Number(brief?.executiveView?.deliveryPct
    ?? brief?.meta?.piConfidence?.confidencePct
    ?? cadenceMeta.deliveryPct) || null;
  const movementHealth = deriveMovementHealth(brief, status);
  const squad = (brief?.squadInsights || []).find((s) => selected.includes(String(s.projectKey || '').toUpperCase()))
    || brief?.squadInsights?.[0]
    || null;
  return {
    projectKey: focus?.projectKey || selected[0] || '',
    status,
    movementHealth,
    sprintDone: Number(squad?.sprintPulse?.done) || 0,
    sprintCommitted: Number(squad?.sprintPulse?.committed) || 0,
    sprintName: lastName,
    lastSprintEnd: lastEnd,
    daysSinceEnd: ago,
    staleDays: Math.round(staleDays),
    deliveryPct,
    epicCount: focus?.epicCount || 0,
    blockerCount: focus?.blockerCount || 0,
    // Cadence verdict tiers (Flaw 33 — escalate by gap duration, not just "ended")
    cadenceVerdict: deriveCadenceVerdict(status, ago, staleDays),
  };
}

/**
 * Derive a cadence verdict tier based on how long since the last sprint ended.
 * Replaces the flat "ended" status with escalating urgency.
 * @param {string} status - none | idle | active | ended | stalled
 * @param {number|null} daysSinceEnd - days since last sprint ended
 * @param {number} staleDays - days the current sprint has been stale
 * @returns {{ tier: string, label: string, severity: string }}
 */
function deriveCadenceVerdict(status, daysSinceEnd, staleDays) {
  if (status === 'active') {
    if (staleDays >= 7) return { tier: 'stalled', label: 'Sprint open · stalled', severity: 'danger' };
    return { tier: 'active', label: 'Sprint active', severity: 'positive' };
  }
  if (status === 'stalled') return { tier: 'stalled', label: 'Sprint open · stalled', severity: 'danger' };
  if (status === 'ended' || status === 'idle') {
    const d = Number(daysSinceEnd);
    if (d == null || !Number.isFinite(d)) return { tier: 'unknown', label: 'No sprint data', severity: 'muted' };
    if (d < 7) return { tier: 'recent', label: 'Recently completed', severity: 'positive' };
    if (d < 14) return { tier: 'gap-warning', label: 'No new sprint — plan next', severity: 'warning' };
    if (d < 30) return { tier: 'gap-risk', label: 'Sprint gap — delivery risk', severity: 'danger' };
    return { tier: 'dormant', label: 'Dormant squad — re-engage', severity: 'danger' };
  }
  return { tier: 'none', label: 'No active sprint', severity: 'muted' };
}

/**
 * Single scope cadence line — timebox + sprint cadence merged (scope bar SSOT).
 */
export function renderScopeCadenceLine(decision = {}, brief = {}) {
  const tb = quarterDayLabel(decision, brief);
  const periodKey = decision.periodKey || brief?.meta?.quarter || 'Current';
  const c = buildCadencePackState(brief);
  const sprintPart = sprintCadencePart(c, brief);
  const baselineEntry = resolveBaselineEntryPoint(brief);
  const timePart = tb.isSet
    ? `${periodKey} · Day ${tb.elapsed}/${tb.total}`
    : (baselineEntry.showScopeCadenceBaselineCta ? COPY.piBaselineNotSavedCta : `${periodKey} · ${COPY.piBaselineNotSaved}`);
  const line = `${timePart} · ${sprintPart}`;
  const trustChip = deriveTrustChipLabel(brief, decision);
  const deliveryLine = !trustChip && c.deliveryPct != null
    ? COPY.cadenceQuarterDelivery.replace('{pct}', String(c.deliveryPct))
    : '';
  const dormantAttr = c.movementHealth === 'dormant' ? ' data-testid="gov-cadence-dormant"' : '';
  // Quarter-end PI commitment request: when 80%+ of the quarter is done,
  // prompt for the next quarter's PI commitments. (Audit 2026-07-15: timing
  // mechanism for requesting PI slides near quarter end.)
  const piRequestChip = (tb.isSet && tb.elapsed / tb.total >= 0.8)
    ? `<span class="gov-cadence-chip gov-cadence-chip--pi-request" data-testid="gov-cadence-pi-request">📋 Request ${nextQuarterLabel(periodKey)} PI slides</span>`
    : '';
  return `
    <div class="gov-cadence-pack gov-scope-cadence-line" data-testid="gov-cadence-pack" data-cadence-status="${escapeHtml(c.status)}" data-movement-health="${escapeHtml(c.movementHealth || 'healthy')}"${dormantAttr} aria-label="${escapeHtml(COPY.cadencePackLabel)}" title="${escapeHtml(line)}">
      <span class="gov-cadence-chip gov-cadence-chip--scope">${escapeHtml(line)}</span>
      ${trustChip ? `<span class="gov-cadence-chip gov-cadence-chip--trust gov-cadence-chip--danger">${escapeHtml(trustChip)}</span>` : ''}
      ${deliveryLine ? `<span class="gov-cadence-chip gov-cadence-chip--delivery">${escapeHtml(deliveryLine)}</span>` : ''}
      ${piRequestChip}
    </div>`;
}

export function renderCadencePack(brief = {}) {
  const c = buildCadencePackState(brief);
  const sprintLine = sprintCadencePart(c, brief);
  const deliveryLine = c.deliveryPct != null
    ? COPY.cadenceQuarterDelivery.replace('{pct}', String(c.deliveryPct))
    : COPY.cadenceQuarterDeliveryUnknown;
  return `
    <div class="gov-cadence-pack" data-testid="gov-cadence-pack" data-cadence-status="${escapeHtml(c.status)}" data-movement-health="${escapeHtml(c.movementHealth || 'healthy')}" aria-label="${escapeHtml(COPY.cadencePackLabel)}">
      <span class="gov-cadence-chip gov-cadence-chip--sprint">${escapeHtml(sprintLine)}</span>
      <span class="gov-cadence-chip gov-cadence-chip--delivery">${escapeHtml(deliveryLine)}</span>
      ${c.epicCount ? `<span class="gov-cadence-chip">${c.epicCount} epics</span>` : ''}
    </div>`;
}

export function mountCadencePack(brief, mountEl) {
  if (!mountEl) return;
  const existing = mountEl.querySelector('[data-testid="gov-cadence-pack"]');
  if (existing) existing.remove();
  mountEl.insertAdjacentHTML('beforeend', renderCadencePack(brief));
}
