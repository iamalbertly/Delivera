/**
 * SSOT: Contextual squad nudge draft for PI leader / SM outreach.
 */
import { firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function mention(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return `@${firstNameFromDisplay(n) || n.split(/\s+/)[0]}`;
}

export function buildSquadNudgeDraft(squad = {}, brief = {}) {
  const pk = squad.projectKey || 'Squad';
  const roles = squad.squadRoles || {};
  const sm = mention(roles.scrumMaster?.displayName);
  const po = mention(roles.productOwner?.displayName);
  const mentions = [sm, po].filter(Boolean).join(' ');
  const bottleneck = squad.bottleneckLine && squad.bottleneckLine !== 'None'
    ? squad.bottleneckLine
    : squad.statusLine || 'delivery needs attention';
  const topRisk = (squad.cardRisks || [])[0];
  const riskLine = topRisk?.displayTitle || topRisk?.issueKey || '';
  const piGap = Number(squad.piGap) || 0;
  const offPlan = Number(squad.offPlanHours) || 0;
  const parts = [];
  if (mentions) parts.push(mentions);
  parts.push(`${pk}: ${bottleneck.slice(0, 120)}`);
  if (riskLine) parts.push(`Top risk: ${riskLine.slice(0, 80)}`);
  if (piGap > 0) parts.push(`${piGap} PI item(s) still open`);
  if (offPlan > 0) parts.push(`${offPlan}h on off-PI work recently`);
  const portfolio = brief?.portfolio || pk;
  parts.push(`Can we align on ${portfolio} priorities this week?`);
  return parts.join(' — ').slice(0, 280);
}
