import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY, portfolioDecisionLabel, formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

/** P1 FIX: Format raw ISO timestamps as human-readable dates instead of
 *  showing "2026-07-14T19:03:48.815Z" to a PMO manager. */
function formatDeadline(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso; // fallback to raw if unparseable
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    // Format as "Jul 14, 6:03 PM"
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch (_) { return iso; }
}

export function decisionActionLabel(decision = {}, brief = {}) {
  // Single constant label — the action triggered is contextual but the label is constant.
  // Users learn the pattern once: "Resolve top gap →" always opens the prepared action queue.
  const prepared = decision?.preparedActions || {};
  const totalReady = Number(prepared.totalReady) || (prepared.items || []).length || 0;
  if (totalReady > 1) return `Resolve top ${Math.min(3, totalReady)} gaps`;
  return 'Resolve top gap';
}

const DRIVER_ICONS = {
  delivery: '📊',
  proof: '🔍',
  evidence: '🔍',
  investment: '💰',
  risk: '⚠️',
  scope: '🎯',
  capacity: '👥',
  commitment: '📌',
  default: '•',
};

function driverIcon(driver = {}) {
  const type = String(driver.type || driver.category || '').toLowerCase();
  for (const [key, glyph] of Object.entries(DRIVER_ICONS)) {
    if (key === 'default') continue;
    if (type.includes(key)) return glyph;
  }
  const title = String(driver.title || '').toLowerCase();
  for (const [key, glyph] of Object.entries(DRIVER_ICONS)) {
    if (key === 'default') continue;
    if (title.includes(key)) return glyph;
  }
  return DRIVER_ICONS.default;
}

export function renderWhyThisMatters(drivers = []) {
  const rows = (drivers || []).slice(0, 3);
  if (!rows.length) return '';
  return `
    <section class="portfolio-why" aria-label="Why this matters">
      <h2 class="portfolio-why-title">Why this matters</h2>
      <dl class="portfolio-keyvalue-list">
        ${rows.map((d) => `
          <div class="portfolio-keyvalue-row" title="${escapeHtml(d.detail || '')}">
            <dt><span class="portfolio-driver-icon" aria-hidden="true">${driverIcon(d)}</span>${escapeHtml(d.title || 'Signal')}</dt>
            <dd>${escapeHtml(d.summary || '')}</dd>
          </div>`).join('')}
      </dl>
    </section>`;
}

function renderTopActionsPanel(decision = {}, brief = {}) {
  const prepared = decision.preparedActions || {};
  const items = (prepared.items || []).filter((i) => i && (i.label || i.title || i.action));
  const totalReady = Number(prepared.totalReady) || items.length;
  const anchor = decision.anchorProject || 'this squad';
  const squadName = resolveProjectDisplay(anchor).primary || anchor;
  const deadline = prepared.nextDeadline || decision.decisionRequired?.dueAt || '';

  if (!items.length) {
    return `
      <section class="portfolio-next-decision portfolio-top-actions" aria-label="Top actions" data-testid="portfolio-top-actions">
        <h2 class="portfolio-next-decision-title">Top actions for ${escapeHtml(squadName)}</h2>
        <p class="portfolio-next-decision-hint">No prepared actions yet — connect a Jira board to see exposure and next steps.</p>
        <nav class="portfolio-quick-links" aria-label="Quick links">
          <a href="/current-sprint?projects=${encodeURIComponent(anchor)}">Squad sprint</a>
        </nav>
      </section>`;
  }

  const top3 = items.slice(0, 3);
  const overflow = items.length - top3.length;

  // Audit fix (click tax): previously every top-action row had its own
  // "Resolve →" primary button, all opening the same drawer. Now only the
  // first (primary) row carries the primary CTA; the rest are tappable rows
  // that open the same drawer, reducing visual noise from N primary buttons
  // to 1.
  return `
    <section class="portfolio-next-decision portfolio-top-actions" aria-label="Top actions" data-testid="portfolio-top-actions">
      <h2 class="portfolio-next-decision-title">Top actions for ${escapeHtml(squadName)}</h2>
      ${deadline ? `<p class="portfolio-top-actions-deadline" data-testid="portfolio-top-actions-deadline">Next response due: <strong>${escapeHtml(formatDeadline(deadline))}</strong></p>` : ''}
      <ul class="portfolio-top-actions-list" data-testid="portfolio-top-actions-list">
        ${top3.map((it, idx) => `
          <li class="portfolio-top-action-item${idx === 0 ? ' is-primary' : ''}" data-testid="portfolio-top-action-item">
            <span class="portfolio-top-action-rank">${idx + 1}</span>
            <div class="portfolio-top-action-body">
              <strong class="portfolio-top-action-label">${escapeHtml(it.label || it.title || it.action || 'Confirm next step')}</strong>
              <span class="portfolio-top-action-owner">${escapeHtml(it.owner || it.role || it.decisionNeededFrom || 'Owner')}</span>
            </div>
            ${idx === 0
              ? `<button type="button" class="btn btn-primary btn-compact portfolio-top-action-cta" data-portfolio-action="view-prepared-items" data-testid="portfolio-top-action-cta">Resolve →</button>`
              : `<button type="button" class="btn btn-link btn-compact portfolio-top-action-cta--secondary" data-portfolio-action="view-prepared-items">Review</button>`}
          </li>`).join('')}
      </ul>
      ${overflow > 0 ? `<button type="button" class="btn btn-link btn-compact portfolio-top-actions-more" data-portfolio-action="view-prepared-items">+${overflow} more</button>` : ''}
      ${prepared.escalationReady ? '<p class="portfolio-prepared-escalation">Escalation ready if no response</p>' : ''}
    </section>`;
}

function renderQuickLinks(decision = {}) {
  const anchor = decision.anchorProject || '';
  const period = decision.periodKey ? `&period=${encodeURIComponent(decision.periodKey)}` : '';
  const squadHref = anchor
    ? `/current-sprint?projects=${encodeURIComponent(anchor)}${period}`
    : '/current-sprint';
  return `
    <nav class="portfolio-quick-links" aria-label="Quick links">
      <button type="button" class="btn btn-link btn-compact" data-portfolio-action="view-governance-evidence">View in Evidence</button>
      <a href="${escapeHtml(squadHref)}">Squad sprint</a>
    </nav>`;
}

export function renderPortfolioDecisionPanel(decision = {}, brief = {}) {
  const topProof = (brief?.evidencePack?.rows || [])[0];
  const inlineProof = topProof
    ? `<p class="portfolio-decision-inline-proof" data-testid="portfolio-inline-evidence"><strong>${escapeHtml(topProof.issueKey || 'Proof')}</strong> · ${escapeHtml(topProof.whyFlagged || topProof.statusNow || 'Needs review')}</p>`
    : '';
  return `
    <div class="portfolio-rail-stack" id="portfolio-decision">
      ${renderWhyThisMatters(decision.drivers || [])}
      ${renderTopActionsPanel(decision, brief)}
      ${inlineProof}
      ${renderQuickLinks(decision, brief)}
    </div>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  // Top actions panel uses delegated click handler (data-portfolio-action="view-prepared-items")
  // which is already bound by handlePortfolioDelegatedClick on #main-content.
  // No radio change handler needed — the dead-end "Continue as planned" radios are removed.
  root._portfolioConfirmHandler = onConfirm;
}
