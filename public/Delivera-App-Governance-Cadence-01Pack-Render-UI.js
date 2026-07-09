/**
 * SSOT: Portfolio cadence pack — last sprint / idle / quarter delivery (no new drawers).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { quarterDayLabel } from './Delivera-App-Portfolio-Signal-01Render-UI.js';
import { maxStaleHoursFromBrief, resolveBaselineEntryPoint } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

function staleLabelFromBrief(brief = {}) {
  const h = maxStaleHoursFromBrief(brief);
  if (h <= 0) return '';
  if (h < 24) return `${Math.round(h)}h stale`;
  return `${Math.round(h / 24)}d stale`;
}

function sprintCadencePart(c, brief = {}) {
  if (c.status === 'active') {
    if (c.movementHealth === 'blocked') {
      const stale = staleLabelFromBrief(brief);
      const pct = c.sprintCommitted > 0 ? Math.round((c.sprintDone / c.sprintCommitted) * 100) : 0;
      return stale
        ? `${COPY.cadenceActiveNoMovement} · ${stale}`
        : `${COPY.cadenceActiveNoMovement.replace('0%', `${pct}%`)}`;
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

function deriveMovementHealth(brief = {}, cadenceStatus = 'idle') {
  if (cadenceStatus === 'none' || cadenceStatus === 'idle' || cadenceStatus === 'ended') {
    return 'dormant';
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
  let status = 'idle';
  if (sprint === 'active') status = 'active';
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
    deliveryPct,
    epicCount: focus?.epicCount || 0,
    blockerCount: focus?.blockerCount || 0,
  };
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
  const deliveryLine = c.deliveryPct != null
    ? COPY.cadenceQuarterDelivery.replace('{pct}', String(c.deliveryPct))
    : '';
  const dormantAttr = c.movementHealth === 'dormant' ? ' data-testid="gov-cadence-dormant"' : '';
  return `
    <div class="gov-cadence-pack gov-scope-cadence-line" data-testid="gov-cadence-pack" data-cadence-status="${escapeHtml(c.status)}" data-movement-health="${escapeHtml(c.movementHealth || 'healthy')}"${dormantAttr} aria-label="${escapeHtml(COPY.cadencePackLabel)}" title="${escapeHtml(line)}">
      <span class="gov-cadence-chip gov-cadence-chip--scope">${escapeHtml(line)}</span>
      ${deliveryLine ? `<span class="gov-cadence-chip gov-cadence-chip--delivery">${escapeHtml(deliveryLine)}</span>` : ''}
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
