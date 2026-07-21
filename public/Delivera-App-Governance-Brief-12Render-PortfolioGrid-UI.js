import { COPY, initialsFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { readCatalogKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { renderPulseBars } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';
import { classifyWorkAlignment, renderAlignmentChip } from './Delivera-Shared-WorkAlignment-01Chip-SSOT.js';

function heatLabel(squad) {
  if (squad.healthSignals?.sprintSetup === 'limited') return 'Needs setup';
  if (squad.verdictTier === 'blocked') return 'Blocked';
  if (squad.verdictTier === 'watch') return 'Needs watch';
  if (!squad.boardResolved) return 'No data';
  return 'On track';
}

function renderRoleAvatar(person, label) {
  if (!person?.displayName) return '';
  return `<span class="gov-squad-role-avatar" title="${escapeHtml(person.displayName)}">${escapeHtml(label)}: ${escapeHtml(initialsFromDisplay(person.displayName))}</span>`;
}

function renderRiskTileDetail(squad, brief, { autoExpand = false, hideNudge = false, collapseHeroDedupe = false } = {}) {
  const pulse = squad.sprintPulse || {};
  const pulseHtml = squad.hidePulseBar ? '' : renderPulseBars(pulse);
  const risks = squad.cardRisks || [];
  const riskLines = risks.slice(0, 2).map((r) => `<li>${escapeHtml(r.displayTitle || r.issueKey)}</li>`).join('');
  const partial = (brief?.meta?.partialProjects || []).includes(squad.projectKey);
  const roles = squad.squadRoles || {};
  const rolesHtml = (roles.scrumMaster?.displayName || roles.productOwner?.displayName)
    ? `<div class="gov-squad-roles-row" data-squad-roles="1">`
      + renderRoleAvatar(roles.scrumMaster, COPY.scrumMaster)
      + renderRoleAvatar(roles.productOwner, COPY.productOwner)
      + '</div>'
    : '';
  const piCommitted = Number(squad.piCommitted) || 0;
  const piDone = Number(squad.piDone) || 0;
  const piPct = piCommitted > 0 ? Math.round((piDone / piCommitted) * 100) : 0;
  const topRiskKey = risks[0]?.issueKey || '';
  const hiddenAttr = autoExpand ? '' : ' hidden';
  const baselineKeys = brief?.meta?.piBaselineCommittedKeys || [];
  const adHocKeys = brief?.meta?.adHocEpics || [];
  const driftAlignment = (Number(squad.offPlanEpicCount) || 0) > 0
    ? classifyWorkAlignment({
      epicKey: risks[0]?.epicKey || '',
      piBaselineCommittedKeys: baselineKeys,
      adHocEpicKeys: adHocKeys,
    })
    : null;
  const driftChip = driftAlignment && driftAlignment.tier !== 'pi'
    ? ` ${renderAlignmentChip(driftAlignment)}`
    : '';
  const piRow = piCommitted === 0
    ? `<p data-squad-pi-row="1" class="gov-pi-empty-cta"><button type="button" class="btn btn-link btn-compact" data-setup-baseline-ssot="1" data-squad="${escapeHtml(squad.projectKey)}">${escapeHtml(COPY.piBaselineNotSavedCta)}</button></p>`
    : `<p data-squad-pi-row="1"><strong>PI:</strong> ${piDone}/${piCommitted} committed · ${piPct}% delivered</p>`;
  const detailRows = collapseHeroDedupe
    ? `${pulseHtml}${piRow}${rolesHtml}${partial ? '<p class="gov-partial-warn">Partial data — squad may be unavailable.</p>' : ''}${riskLines ? `<ul class="gov-risk-tile-risks">${riskLines}</ul>` : ''}`
    : `${pulseHtml}${piRow}<p data-squad-drift-row="1"><strong>${escapeHtml(COPY.unplannedTime)}:</strong> ${Number(squad.offPlanHours) || 0}h ad-hoc · ${Number(squad.offPlanEpicCount) || 0} off-PI epics${driftChip}${squad.driftSince ? ` · since ${escapeHtml(squad.driftSince)}` : ''}</p>${rolesHtml}<p><strong>Cause:</strong> ${escapeHtml(squad.bottleneckLine || squad.statusLine || '—')}</p><p><strong>Action:</strong> ${escapeHtml(squad.productivityLine || '')}</p>${partial ? '<p class="gov-partial-warn">Partial data — squad may be unavailable.</p>' : ''}${riskLines ? `<ul class="gov-risk-tile-risks">${riskLines}</ul>` : ''}`;
  return `
    <div class="gov-risk-tile-detail" data-tile-detail="${escapeHtml(squad.projectKey)}"${hiddenAttr}${collapseHeroDedupe ? ' data-hero-deduped="1"' : ''}>
      ${detailRows}
      <div class="gov-squad-detail-actions">
        ${hideNudge ? '' : `<button type="button" class="btn btn-primary btn-compact" data-squad-nudge="${escapeHtml(squad.projectKey)}" data-squad-nudge-issue="${escapeHtml(topRiskKey)}">${escapeHtml(COPY.nudgeSmPo)}</button>`}
        <a class="btn btn-secondary btn-compact" href="/current-sprint">${escapeHtml(COPY.openSprint)}</a>
        <button type="button" class="btn btn-link btn-compact gov-proof-chip" data-proof-squad="${escapeHtml(squad.projectKey)}">Open evidence</button>
      </div>
    </div>`;
}

export function renderPortfolioGrid(brief, { singleSquad = false, hideSquadNudge = false, collapseHeroDedupe = false } = {}) {
  const rollup = brief?.portfolioRollup || {};
  const squads = Array.isArray(brief?.squadInsights) ? brief.squadInsights : [];
  const partialNote = (brief?.meta?.partialProjects || []).length
    ? `<p class="gov-partial-banner">Partial data: ${escapeHtml(brief.meta.partialProjects.join(' unavailable'))}</p>`
    : '';
  const showTray = squads.length >= 5 && !singleSquad;
  const since = brief?.meta?.workerReceipt?.sinceLastRun || brief?.meta?.sinceLastRun;
  const sinceLabel = typeof since === 'object' && since !== null ? (since.summary || '') : String(since || '');
  const cacheNote = sinceLabel ? ` · ${escapeHtml(sinceLabel)}` : '';
  const filterBar = showTray ? `
    <details class="gov-comparison-refine">
      <summary class="btn btn-link btn-compact">${escapeHtml(COPY.refineSquads)}</summary>
      <div class="gov-comparison-tray-bar" role="group" aria-label="Squad comparison filters">
        <button type="button" class="gov-comparison-filter is-on" data-comparison-filter="all">All</button>
        <button type="button" class="gov-comparison-filter" data-comparison-filter="blocked">Blocked</button>
        <button type="button" class="gov-comparison-filter" data-comparison-filter="watch">Watch</button>
        <button type="button" class="gov-comparison-filter" data-comparison-filter="on-track">On track</button>
      </div>
    </details>` : '';
  const maxVisible = showTray ? 8 : squads.length;
  const visibleSquads = squads.slice(0, maxVisible);
  const hiddenCount = squads.length - visibleSquads.length;
  const tiles = visibleSquads.map((s, idx) => {
    const pk = s.projectKey || '';
    const tier = s.verdictTier || 'watch';
    const expanded = singleSquad && idx === 0;
    return `
      <button type="button" class="gov-heat-tile gov-heat-tile--${escapeHtml(tier)}" data-heat-tile="${escapeHtml(pk)}" data-verdict-tier="${escapeHtml(tier)}" style="--tile-tier:${escapeHtml(tier)}" aria-expanded="${expanded ? 'true' : 'false'}">
        <span class="gov-heat-key">${escapeHtml(pk)}</span>
        <span class="gov-heat-verdict">${escapeHtml(heatLabel(s))}</span>
        ${showTray ? `<span class="gov-heat-pin" data-pin-tile="${escapeHtml(pk)}" role="button" tabindex="0" title="Pin tile">📌</span>` : ''}
      </button>`;
  }).join('');
  const moreChip = hiddenCount > 0
    ? `<button type="button" class="gov-heat-tile gov-heat-tile--more" id="gov-heat-show-more">+${hiddenCount} more</button>`
    : '';
  const details = squads.map((s, idx) => renderRiskTileDetail(s, brief, {
    autoExpand: singleSquad && idx === 0,
    hideNudge: hideSquadNudge,
    collapseHeroDedupe: collapseHeroDedupe && singleSquad,
  })).join('');
  const line = rollup.summaryLine || COPY.portfolioRollupOk;
  const isStale = String(brief?.freshness?.confidenceLimit || '').toLowerCase() === 'stale';
  const staleNote = isStale ? ` · ${COPY.portfolioStaleHint}` : '';
  if (singleSquad && squads.length === 1) {
    const selected = Array.isArray(brief?.projects) ? brief.projects.map((p) => String(p).toUpperCase()) : [];
    const compareCandidates = readCatalogKeys().filter((pk) => !selected.includes(pk)).slice(0, 3);
    const compareTray = compareCandidates.length
      ? `<div class="gov-compare-add-tray" data-compare-add-tray="1" role="group" aria-label="Add squad to compare">
          <span class="gov-scope-label">Add to compare</span>
          ${compareCandidates.map((pk) => {
            const inCompare = selected.includes(pk);
            return `<button type="button" class="gov-scope-chip${inCompare ? ' is-on' : ''}" data-compare-add="${escapeHtml(pk)}" aria-pressed="${inCompare ? 'true' : 'false'}">+ ${escapeHtml(pk)}</button>`;
          }).join('')}
        </div>`
      : '';
    return `
    <div class="gov-portfolio-grid-wrap gov-portfolio-grid-wrap--single" aria-label="${escapeHtml(COPY.executiveLeaderboard)}">
      <p class="gov-portfolio-banner-line${isStale ? ' is-stale' : ''}" data-portfolio-banner="1">${escapeHtml(line)}${cacheNote}${escapeHtml(staleNote)}</p>
      ${partialNote}
      ${compareTray}
      <div class="gov-risk-tile-details gov-risk-tile-details--always-open">${details}</div>
    </div>`;
  }
  return `
    <div class="gov-portfolio-grid-wrap${showTray ? ' gov-portfolio-grid-wrap--tray' : ''}" aria-label="${escapeHtml(COPY.executiveLeaderboard)}">
      <p class="gov-portfolio-banner-line${isStale ? ' is-stale' : ''}" data-portfolio-banner="1">${escapeHtml(line)}${cacheNote}${escapeHtml(staleNote)}</p>
      ${partialNote}
      ${filterBar}
      <div class="gov-risk-heat-row" role="list">${tiles}${moreChip}</div>
      <div class="gov-risk-tile-details">${details}</div>
    </div>`;
}

/** Compact side-by-side compare column for right rail (2+ squads). */
export function renderCompareRail(brief, selectedKeys = []) {
  const keys = (Array.isArray(selectedKeys) ? selectedKeys : []).map((k) => String(k).toUpperCase());
  if (keys.length < 2) return '';
  const squads = (Array.isArray(brief?.squadInsights) ? brief.squadInsights : [])
    .filter((s) => keys.includes(String(s.projectKey || '').toUpperCase()));
  if (squads.length < 2) return '';
  const cards = squads.map((s) => {
    const partial = (brief?.meta?.partialProjects || []).includes(s.projectKey);
    const piCommitted = Number(s.piCommitted) || 0;
    const piDone = Number(s.piDone) || 0;
    return `<article class="gov-compare-rail-card gov-heat-tile--${escapeHtml(s.verdictTier || 'watch')}" data-compare-rail-card="${escapeHtml(s.projectKey)}">
      <header><strong>${escapeHtml(s.projectKey)}</strong> · ${escapeHtml(heatLabel(s))}</header>
      <p>${escapeHtml(s.bottleneckLine || s.statusLine || '—')}</p>
      ${piCommitted > 0 ? `<p class="gov-compare-rail-pi">${piDone}/${piCommitted} PI</p>` : `<p class="gov-compare-rail-pi gov-pi-empty-cta">${escapeHtml(COPY.piBaselineNotSavedCta)}</p>`}
      ${partial ? '<p class="gov-partial-warn">Partial data</p>' : ''}
    </article>`;
  }).join('');
  return `<section class="gov-compare-rail" data-compare-rail="1" aria-label="Squad compare">${cards}</section>`;
}

export function bindRiskHeatInteractions(root, brief, onProofSquad, onSquadNudge) {
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
  const toggleHeatTile = (btn) => {
    const pk = btn.getAttribute('data-heat-tile');
    if (!pk || btn.classList.contains('gov-heat-tile--more')) return;
    const detail = root.querySelector(`[data-tile-detail="${pk}"]`);
    const open = detail?.hasAttribute('hidden');
    root.querySelectorAll('[data-tile-detail]').forEach((d) => d.setAttribute('hidden', ''));
    root.querySelectorAll('[data-heat-tile]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (open && detail) {
      detail.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }
  };
  root.querySelectorAll('[data-heat-tile]').forEach((btn) => {
    btn.addEventListener('click', () => toggleHeatTile(btn));
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        toggleHeatTile(btn);
      }
    });
  });
  root.querySelectorAll('[data-proof-squad]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const pk = btn.getAttribute('data-proof-squad');
      const squad = (brief?.squadInsights || []).find((s) => s.projectKey === pk);
      const keys = (squad?.cardRisks || []).map((r) => r.issueKey).filter(Boolean);
      onProofSquad?.(keys, squad);
    });
  });
  root.querySelectorAll('[data-squad-nudge]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const pk = btn.getAttribute('data-squad-nudge');
      const squad = (brief?.squadInsights || []).find((s) => s.projectKey === pk);
      onSquadNudge?.(squad, btn.getAttribute('data-squad-nudge-issue') || '');
    });
  });
}
