import {
  COPY, deliveryStatusLabel, freshnessShortLabel,
} from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { buildDecisionsRows } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

export function renderMeetingHero(brief) {
  const n = brief?.leadershipNarrative || {};
  const text = n.meetingAnswer || n.oneParagraph || n.headline || 'Loading delivery answer...';
  const status = deliveryStatusLabel(n.confidence);
  const statusLineClass = status === 'At risk' ? 'gov-status-at-risk' : status === 'Watch' ? 'gov-status-watch' : 'gov-status-on-track';
  return `
    <section class="gov-meeting-hero" aria-label="${escapeHtml(COPY.briefTitle)}">
      <p class="gov-meeting-hero-text">${escapeHtml(text)}</p>
      <p class="gov-meeting-status-line ${statusLineClass}"><strong>${escapeHtml(COPY.deliveryStatus)}:</strong> ${escapeHtml(status)}</p>
    </section>`;
}

export function renderWhatToSay(brief) {
  const n = brief?.leadershipNarrative || {};
  const say = n.whatToSay || '';
  if (!say) return '';
  return `
    <section class="gov-what-to-say-wrap" aria-label="${escapeHtml(COPY.whatToSayHeading)}">
      <h2 class="governance-section-title">${escapeHtml(COPY.whatToSayHeading)}</h2>
      <blockquote class="gov-what-to-say">"${escapeHtml(say)}"</blockquote>
    </section>`;
}

export function renderHabitStrip(brief) {
  const actions = buildDecisionsRows(brief).length;
  const nudgeable = (brief?.topRisks || []).filter((r) => r.issueKey).length;
  if (!actions && !nudgeable) return '';
  return `
    <p class="gov-habit-strip" role="status">
      <strong>Today:</strong> ${actions} action${actions === 1 ? '' : 's'} need follow-up.
      ${nudgeable ? `${nudgeable} can use a Jira nudge.` : ''}
    </p>`;
}

export function renderSentenceKpis(brief) {
  const n = brief?.leadershipNarrative || {};
  const actions = buildDecisionsRows(brief).length;
  const attention = (brief?.topRisks?.length || 0) + (brief?.portfolioRisks?.length || 0);
  const fresh = freshnessShortLabel(brief?.freshness || {});
  const lines = [
    `${COPY.deliveryStatus}: ${deliveryStatusLabel(n.confidence)}`,
    `${COPY.actionsNeeded}: ${actions}`,
    `${COPY.whatNeedsAttention}: ${attention}`,
    `${COPY.dataFreshness}: ${fresh}`,
  ];
  return `<div class="gov-kpi-sentences" role="group">${lines.map((l) => `<div class="gov-chip-sentence">${escapeHtml(l)}</div>`).join('')}</div>`;
}

export function buildMeetingAnswerClipboard(brief) {
  const n = brief?.leadershipNarrative || {};
  const ev = brief?.executiveView || {};
  const status = deliveryStatusLabel(n.confidence);
  const parts = [];
  parts.push(ev.verdictLine || n.meetingAnswer || n.oneParagraph || '');
  if (n.meetingScript) parts.push(n.meetingScript);
  else if (n.whatToSay) parts.push(`What to say: "${n.whatToSay}"`);
  const rows = buildDecisionsRows(brief).slice(0, 3);
  for (const r of rows) {
    parts.push(`${r.owner}: ${r.action}`);
  }
  return `${brief?.portfolio || 'Portfolio'} — ${status}.\n\n${parts.filter(Boolean).join('\n\n')}`;
}
