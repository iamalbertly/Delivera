import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { renderPulseBars, squadVerdictLabel } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';

function heatLabel(squad) {
  if (squad.healthSignals?.sprintSetup === 'limited') return 'Needs setup';
  if (squad.verdictTier === 'blocked') return 'Blocked';
  if (squad.verdictTier === 'watch') return 'Needs watch';
  if (!squad.boardResolved) return 'No data';
  return 'On track';
}

function renderRiskTileDetail(squad, brief) {
  const pulse = squad.sprintPulse || {};
  const pulseHtml = squad.hidePulseBar ? '' : renderPulseBars(pulse);
  const risks = squad.cardRisks || [];
  const riskLines = risks.slice(0, 2).map((r) => `<li>${escapeHtml(r.displayTitle || r.issueKey)}</li>`).join('');
  const partial = (brief?.meta?.partialProjects || []).includes(squad.projectKey);
  return `
    <div class="gov-risk-tile-detail" data-tile-detail="${escapeHtml(squad.projectKey)}" hidden>
      ${pulseHtml}
      <p><strong>Cause:</strong> ${escapeHtml(squad.bottleneckLine || squad.statusLine || '—')}</p>
      <p><strong>Owner lane:</strong> ${escapeHtml(squad.assigneeHighlight ? `Assignee ${squad.assigneeHighlight}` : 'See action cluster')}</p>
      <p><strong>Action:</strong> ${escapeHtml(squad.productivityLine || '')}</p>
      <p><strong>Evidence:</strong> ${risks.length} risk signal${risks.length === 1 ? '' : 's'}</p>
      ${partial ? '<p class="gov-partial-warn">Partial data — squad may be unavailable.</p>' : ''}
      ${riskLines ? `<ul class="gov-risk-tile-risks">${riskLines}</ul>` : ''}
      <button type="button" class="btn btn-link btn-compact gov-proof-chip" data-proof-squad="${escapeHtml(squad.projectKey)}">Open evidence</button>
    </div>`;
}

export function renderPortfolioGrid(brief) {
  const rollup = brief?.portfolioRollup || {};
  const squads = Array.isArray(brief?.squadInsights) ? brief.squadInsights : [];
  const partialNote = (brief?.meta?.partialProjects || []).length
    ? `<p class="gov-partial-banner">Partial data: ${escapeHtml(brief.meta.partialProjects.join(' unavailable'))}</p>`
    : '';
  const showTray = squads.length >= 5;
  const filterBar = showTray ? `
    <div class="gov-comparison-tray-bar" role="group" aria-label="Squad comparison filters">
      <button type="button" class="gov-comparison-filter is-on" data-comparison-filter="all">All</button>
      <button type="button" class="gov-comparison-filter" data-comparison-filter="blocked">Blocked</button>
      <button type="button" class="gov-comparison-filter" data-comparison-filter="watch">Watch</button>
      <button type="button" class="gov-comparison-filter" data-comparison-filter="on-track">On track</button>
    </div>` : '';
  const maxVisible = showTray ? 8 : squads.length;
  const visibleSquads = squads.slice(0, maxVisible);
  const hiddenCount = squads.length - visibleSquads.length;
  const tiles = visibleSquads.map((s) => {
    const pk = s.projectKey || '';
    const tier = s.verdictTier || 'watch';
    return `
      <button type="button" class="gov-heat-tile gov-heat-tile--${escapeHtml(tier)}" data-heat-tile="${escapeHtml(pk)}" data-verdict-tier="${escapeHtml(tier)}" style="--tile-tier:${escapeHtml(tier)}" aria-expanded="false">
        <span class="gov-heat-key">${escapeHtml(pk)}</span>
        <span class="gov-heat-verdict">${escapeHtml(heatLabel(s))}</span>
        ${showTray ? `<span class="gov-heat-pin" data-pin-tile="${escapeHtml(pk)}" role="button" tabindex="0" title="Pin tile">📌</span>` : ''}
      </button>`;
  }).join('');
  const moreChip = hiddenCount > 0
    ? `<button type="button" class="gov-heat-tile gov-heat-tile--more" id="gov-heat-show-more">+${hiddenCount} more</button>`
    : '';
  const details = squads.map((s) => renderRiskTileDetail(s, brief)).join('');
  const line = rollup.summaryLine || COPY.portfolioRollupOk;
  return `
    <div class="gov-portfolio-grid-wrap${showTray ? ' gov-portfolio-grid-wrap--tray' : ''}" aria-label="${escapeHtml(COPY.executiveLeaderboard)}">
      <p class="gov-portfolio-banner-line">${escapeHtml(line)}</p>
      ${partialNote}
      ${filterBar}
      <div class="gov-risk-heat-row" role="list">${tiles}${moreChip}</div>
      <div class="gov-risk-tile-details">${details}</div>
    </div>`;
}

export function bindRiskHeatInteractions(root, brief, onProofSquad) {
  if (!root) return;
  root.querySelector('#gov-heat-show-more')?.addEventListener('click', () => {
    root.querySelectorAll('[data-heat-tile]').forEach((t) => { t.hidden = false; });
    root.querySelector('#gov-heat-show-more')?.remove();
  });
  root.querySelectorAll('[data-comparison-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-comparison-filter');
      root.querySelectorAll('[data-comparison-filter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      root.querySelectorAll('[data-heat-tile]').forEach((tile) => {
        const tier = tile.getAttribute('data-verdict-tier') || '';
        let show = filter === 'all';
        if (filter === 'blocked') show = tier === 'blocked';
        else if (filter === 'watch') show = tier === 'watch';
        else if (filter === 'on-track') show = tier === 'on-track' || tier === 'ok';
        tile.hidden = !show;
      });
    });
  });
  root.querySelectorAll('[data-pin-tile]').forEach((pin) => {
    const stop = (ev) => ev.stopPropagation();
    pin.addEventListener('click', stop);
    pin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') stop(ev); });
    pin.addEventListener('click', () => {
      const pk = pin.getAttribute('data-pin-tile');
      const tile = root.querySelector(`[data-heat-tile="${pk}"]`);
      if (!tile) return;
      root.querySelectorAll('[data-heat-tile]').forEach((t) => t.classList.remove('is-pinned'));
      tile.classList.add('is-pinned');
      tile.parentElement?.prepend(tile);
    });
  });
  root.querySelectorAll('[data-heat-tile]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pk = btn.getAttribute('data-heat-tile');
      const detail = root.querySelector(`[data-tile-detail="${pk}"]`);
      const open = detail?.hasAttribute('hidden');
      root.querySelectorAll('[data-tile-detail]').forEach((d) => d.setAttribute('hidden', ''));
      root.querySelectorAll('[data-heat-tile]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (open && detail) {
        detail.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  root.querySelectorAll('[data-proof-squad]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pk = btn.getAttribute('data-proof-squad');
      const squad = (brief?.squadInsights || []).find((s) => s.projectKey === pk);
      const keys = (squad?.cardRisks || []).map((r) => r.issueKey).filter(Boolean);
      onProofSquad?.(keys, squad);
    });
  });
}
