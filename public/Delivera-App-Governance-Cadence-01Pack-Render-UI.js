/**
 * SSOT: Portfolio cadence pack — last sprint / idle / quarter delivery (no new drawers).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { quarterDayLabel } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

function daysAgo(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
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
  return {
    projectKey: focus?.projectKey || selected[0] || '',
    status,
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
  let sprintPart = COPY.cadenceNoSprint;
  if (c.status === 'active') {
    sprintPart = COPY.cadenceActiveSprint.replace('{name}', c.sprintName || 'Active sprint');
  } else if (c.status === 'ended' && c.daysSinceEnd != null) {
    sprintPart = COPY.cadenceSprintEnded
      .replace('{name}', c.sprintName || 'Last sprint')
      .replace('{days}', String(c.daysSinceEnd));
  }
  const timePart = tb.isSet
    ? `${periodKey} · Day ${tb.elapsed}/${tb.total}`
    : COPY.piBaselineNotSavedCta;
  const line = `${timePart} · ${sprintPart}`;
  const deliveryLine = c.deliveryPct != null
    ? COPY.cadenceQuarterDelivery.replace('{pct}', String(c.deliveryPct))
    : '';
  return `
    <div class="gov-cadence-pack gov-scope-cadence-line" data-testid="gov-cadence-pack" data-cadence-status="${escapeHtml(c.status)}" aria-label="${escapeHtml(COPY.cadencePackLabel)}" title="${escapeHtml(line)}">
      <span class="gov-cadence-chip gov-cadence-chip--scope">${escapeHtml(line)}</span>
      ${deliveryLine ? `<span class="gov-cadence-chip gov-cadence-chip--delivery">${escapeHtml(deliveryLine)}</span>` : ''}
    </div>`;
}

export function renderCadencePack(brief = {}) {
  const c = buildCadencePackState(brief);
  let sprintLine = COPY.cadenceNoSprint;
  if (c.status === 'active') {
    sprintLine = COPY.cadenceActiveSprint.replace('{name}', c.sprintName || 'Active sprint');
  } else if (c.status === 'ended' && c.daysSinceEnd != null) {
    sprintLine = COPY.cadenceSprintEnded
      .replace('{name}', c.sprintName || 'Last sprint')
      .replace('{days}', String(c.daysSinceEnd));
  }
  const deliveryLine = c.deliveryPct != null
    ? COPY.cadenceQuarterDelivery.replace('{pct}', String(c.deliveryPct))
    : COPY.cadenceQuarterDeliveryUnknown;
  return `
    <div class="gov-cadence-pack" data-testid="gov-cadence-pack" data-cadence-status="${escapeHtml(c.status)}" aria-label="${escapeHtml(COPY.cadencePackLabel)}">
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
