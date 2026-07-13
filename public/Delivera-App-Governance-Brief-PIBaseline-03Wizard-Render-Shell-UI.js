/**
 * PI baseline wizard — shell / empty / slide / candidates HTML.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderSurfaceStateHtml } from './Delivera-Shared-Surface-State-01SSOT.js';
import { renderCreateWorkButton } from './Delivera-App-Shared-CreateWork-01Button-Render-SSOT.js';
import {
  candidateRow,
  countMissing,
  fewItemsBanner,
  resolveHint,
} from './Delivera-App-Governance-Brief-PIBaseline-02Wizard-Render-Rows-UI.js';

export function renderStepsFold(open = false) {
  return `
    <details class="gov-baseline-steps-fold"${open ? ' open' : ''}>
      <summary>How this works</summary>
      <ol class="gov-baseline-steps">
        <li>${escapeHtml(COPY.baselineStep1)}</li>
        <li>${escapeHtml(COPY.baselineStep2)}</li>
        <li>${escapeHtml(COPY.baselineStep3)}</li>
      </ol>
    </details>`;
}

export function renderContextBanner(projectsCsv, quarterLabel, opts = {}) {
  const parts = projectsCsv.split(',').map((p) => p.trim()).filter(Boolean);
  const projects = parts.join(', ') || '—';
  const pk = (parts[0] || '').toUpperCase();
  const inferred = Number(opts.commitmentCount) > 0;
  const scopeSquad = (pk === 'SD' || /dms/i.test(pk)) ? 'DMS' : pk;
  const detectedSquad = opts.inferredSquad || opts.cachedSquad || scopeSquad || '';
  const squad = detectedSquad || 'Not detected';
  const quarter = quarterLabel || opts.inferredQuarter || 'Not set';
  const slideMismatch = Boolean(opts.slideScopeMismatch);
  const quarterMismatch = Boolean(opts.inferredQuarter && quarterLabel
    && String(opts.inferredQuarter).trim() !== String(quarterLabel).trim());
  const mismatchHint = slideMismatch
    ? `<p class="gov-baseline-squad-warn" data-testid="gov-baseline-squad-mismatch">${escapeHtml(COPY.baselineSquadMismatch)} <button type="button" class="btn btn-link btn-compact" data-baseline-switch-sd="1">Use SD (DMS)</button></p>`
    : '';
  const quarterHint = quarterMismatch
    ? `<p class="gov-baseline-quarter-warn" data-testid="gov-baseline-quarter-mismatch">Slide shows ${escapeHtml(String(opts.inferredQuarter))} — <button type="button" class="btn btn-link btn-compact" data-baseline-switch-quarter="${escapeHtml(String(opts.inferredQuarter))}">Switch to ${escapeHtml(String(opts.inferredQuarter))}</button></p>`
    : '';
  return `
    <div class="gov-baseline-context" data-testid="gov-baseline-context">
      <span><strong>Project:</strong> ${escapeHtml(projects)}</span>
      <span><strong>Squad:</strong> ${escapeHtml(squad)}${detectedSquad ? (opts.cachedUploadDate ? ` · saved ${escapeHtml(opts.cachedUploadDate)}` : '') : ' <span class="gov-baseline-context-muted">(upload slide)</span>'}</span>
      <span><strong>Quarter:</strong> ${escapeHtml(quarter)}</span>
      <p class="gov-baseline-context-why">${escapeHtml(COPY.piBaselineWhy)}</p>
      ${mismatchHint}
      ${quarterHint}
    </div>`;
}

export function slideUploadInner(aiCapability = null) {
  const ready = Boolean(aiCapability?.slideVisionReady);
  const label = aiCapability?.label || 'server';
  const source = aiCapability?.source || 'none';
  const readyAttr = ready ? '1' : '0';
  let hintHtml = '';
  if (ready) {
    const msg = source === 'browser'
      ? COPY.aiSlideBrowserReady.replace('{label}', label)
      : COPY.aiSlideServerReady.replace('{label}', label);
    hintHtml = `<p class="gov-inbox-hint gov-baseline-ai-hint gov-baseline-ai-hint--ready" data-ai-slide-ready="1">${escapeHtml(msg)}</p>`;
  } else if (aiCapability?.reason === 'browser_test_required') {
    hintHtml = `<p class="gov-inbox-hint gov-baseline-ai-hint" data-ai-slide-ready="0">Test your browser API key in Settings, or use server AI in .env. <a href="/settings?return=/governance&amp;openAlignment=slide">Settings</a></p>`;
  } else {
    hintHtml = `<p class="gov-inbox-hint gov-baseline-ai-hint" data-ai-slide-ready="0">${escapeHtml(COPY.aiKeyRequiredSlide)} <a href="/settings?return=/governance&amp;openAlignment=slide">Settings</a></p>`;
  }
  const disabledClass = ready ? '' : ' gov-baseline-slide-drop--disabled';
  return `
    <label class="gov-baseline-slide-drop${disabledClass}" id="gov-baseline-slide-drop" data-ai-slide-ready="${readyAttr}"${ready ? '' : ' aria-disabled="true"'}>
      <span>${escapeHtml(COPY.baselineSlideUpload)}</span>
      <span class="gov-baseline-slide-hint">Drag &amp; drop or click</span>
      <input type="file" id="gov-baseline-slide-input" accept="image/png,image/jpeg,image/webp"${ready ? '' : ' disabled'} />
    </label>
    ${hintHtml}`;
}

export function slideUploadOptional(collapsed = true, aiCapability = null) {
  return `
    <details class="gov-baseline-optional"${collapsed ? '' : ' open'} data-testid="gov-baseline-slide-optional">
      <summary>${escapeHtml(COPY.piBaselineOptionalSlide)}</summary>
      ${slideUploadInner(aiCapability)}
    </details>`;
}

export function renderLoading(message = COPY.baselineLoading, cachedRows = []) {
  const preview = cachedRows.length
    ? `<div class="gov-baseline-cached-preview" data-testid="gov-baseline-cached-preview">
        <p class="gov-inbox-hint">${cachedRows.length} commitment${cachedRows.length === 1 ? '' : 's'} from last brief — refreshing match…</p>
        <ul class="gov-baseline-cached-list">${cachedRows.slice(0, 5).map((r) => `<li>${escapeHtml(r.title || r.baselinePromise || r.issueKey || 'Commitment')}</li>`).join('')}</ul>
      </div>`
    : '';
  return renderSurfaceStateHtml({ variant: 'loading', message, compact: true }) + preview;
}

export function renderSlideActionsBar(data, projectsCsv) {
  const missingN = countMissing(data);
  const narrative = data.createWorkNarrative || '';
  const matched = Number(data.matchedCount) || (data.candidates || []).filter((c) => c.issueKey).length;
  const total = (data.resolved || []).length || matched + missingN;
  const receipt = data.createReceipt || null;
  const receiptRow = receipt
    ? `<p class="gov-baseline-create-receipt gov-baseline-status gov-baseline-status--warn" data-testid="gov-baseline-create-receipt">${escapeHtml(COPY.baselineSlideCreatePartial.replace('{created}', String(receipt.created || 0)).replace('{failed}', String(receipt.failed || 0)))}</p>`
    : '';
  const summary = total
    ? `<p class="gov-inbox-hint" data-testid="gov-baseline-slide-summary">${escapeHtml(COPY.baselineSlideEpicSummary.replace('{matched}', String(matched)).replace('{missing}', String(missingN)))}</p>`
    : '';
  const aligned = missingN === 0 && matched > 0 && !receipt?.failed
    ? `<p class="gov-baseline-status gov-baseline-status--ok" data-testid="gov-baseline-aligned">${escapeHtml(COPY.baselineSlideAligned)}</p>`
    : '';
  const createAll = missingN > 0
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-create-all" data-testid="gov-baseline-create-all">${escapeHtml(COPY.baselineSlideCreateAll.replace('{n}', String(missingN)))}</button>`
    : '';
  const reviewBtn = narrative
    ? renderCreateWorkButton({ projectsCsv, prefill: narrative, testId: 'gov-baseline-create-work' })
    : '';
  return `${receiptRow}${aligned}${summary}<div class="gov-baseline-slide-actions">${createAll}${reviewBtn}</div>`;
}

export function renderBaselineWizardShell({
  mode,
  data,
  projectsCsv,
  quarterLabel,
  listHtml = '',
  extraHint = '',
  showConfirm = false,
  showRefresh = false,
  showCreate = false,
  jiraUrl = '',
  stepsOpen = false,
  slideCollapsed = true,
  aiCapability = null,
  slideActionsHtml = '',
  contextOpts = {},
}) {
  const title = mode === 'slide'
    ? `${COPY.alignmentStudioTitle} · ${COPY.alignmentStudioModeSlide}`
    : mode === 'empty'
      ? COPY.alignmentStudioTitle
      : `${COPY.alignmentStudioTitle} · ${COPY.alignmentStudioModeBoard} (${(data.candidates || []).length})`;
  const hint = mode === 'candidates' || mode === 'slide'
    ? COPY.baselineConfirmHint
    : extraHint;
  const confirmBtn = showConfirm
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm" data-testid="gov-baseline-save">${escapeHtml(COPY.baselineConfirmBtn)}</button>`
    : '';
  const refreshBtn = showRefresh
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-refresh">${escapeHtml(COPY.refreshBrief)}</button>`
    : '';
  const jiraBtn = jiraUrl
    ? `<a class="btn btn-secondary btn-compact" href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>`
    : '';
  // Empty board: slide-first in Studio — no fork to Work Draft for epic create
  const createBtn = '';
  const slideBlock = mode === 'empty'
    ? `<div class="gov-baseline-slide-hero">${slideUploadInner(aiCapability)}</div>`
    : slideUploadOptional(slideCollapsed, aiCapability);
  const refreshListBtn = mode === 'candidates' || mode === 'slide'
    ? `<button type="button" class="btn btn-link btn-compact" id="gov-baseline-refresh-list">${escapeHtml(COPY.refreshBrief)} list</button>`
    : '';

  const stickySave = showConfirm
    ? `<div class="gov-baseline-sticky-save" data-testid="gov-baseline-sticky-save">${confirmBtn}</div>`
    : '';

  return `
    <div class="gov-baseline-wizard" data-propose-method="${escapeHtml(data.method || 'manual')}">
      ${renderContextBanner(projectsCsv, quarterLabel, contextOpts)}
      <p class="gov-baseline-wizard-title">${escapeHtml(title)}</p>
      ${mode === 'empty' ? slideBlock : ''}
      ${renderStepsFold(stepsOpen || mode === 'empty')}
      ${hint ? `<p class="gov-inbox-hint">${escapeHtml(hint)}</p>` : ''}
      ${mode === 'candidates' || mode === 'slide' ? fewItemsBanner(data) : ''}
      ${listHtml}
      ${slideActionsHtml}
      ${mode !== 'empty' ? slideBlock : ''}
      <div class="gov-baseline-actions">
        ${createBtn}
        ${mode === 'empty' || mode === 'slide' ? '' : confirmBtn}
        ${refreshBtn}
        ${refreshListBtn}
        ${jiraBtn}
        <button type="button" class="btn btn-link btn-compact gov-baseline-close-btn" data-baseline-close>${escapeHtml(COPY.close)}</button>
      </div>
      ${stickySave}
    </div>`;
}

export function renderEmpty(data, jiraUrl, projectsCsv, quarterLabel, partial = false, errorHint = '', aiCapability = null) {
  return renderBaselineWizardShell({
    mode: 'empty',
    data,
    projectsCsv,
    quarterLabel,
    extraHint: errorHint || resolveHint(data, partial),
    showRefresh: true,
    showCreate: false,
    jiraUrl,
    stepsOpen: false,
    slideCollapsed: false,
    aiCapability,
    contextOpts: {
      inferredSquad: data?.inferredSquad || '',
      inferredQuarter: data?.inferredQuarter || '',
      slideScopeMismatch: data?.slideScopeMismatch || false,
      commitmentCount: (data?.extracted || []).length || data?.extractionMeta?.commitmentCount || 0,
    },
  });
}

export function renderSlideReview(data, projectsCsv, quarterLabel, jiraHost = null, aiCapability = null) {
  const extracted = (data.extracted || []).slice(0, 12).map((r) => `
    <li>${escapeHtml([r.month, r.theme, r.bullet].filter(Boolean).join(' · '))}</li>`).join('');
  const dupOnly = (data.duplicateRisk || []).filter((c) => c.method === 'slide-duplicate-risk' && c.issueKey);
  const unmatchedRaw = (data.unmatched || []).filter((c) => c.method !== 'slide-duplicate-risk' || !c.issueKey);
  const unmatched = unmatchedRaw.map((c, i) => candidateRow(c, `u-${i}`, jiraHost)).join('');
  const dupReview = dupOnly.map((c, i) => candidateRow(c, `d-${i}`, jiraHost)).join('');
  const confirmable = (data.candidates || []).filter((c) => c.issueKey && c.method !== 'slide-duplicate-risk');
  const rows = confirmable.map((c, i) => candidateRow(c, i, jiraHost)).join('');
  data._confirmable = confirmable;
  const hasConfirmable = confirmable.length > 0 && !data.createReceipt?.failed;
  const cachedBanner = data.cached
    ? `<p class="gov-baseline-cached-hint" role="status" data-testid="gov-baseline-slide-cached">${escapeHtml(COPY.baselineSlideCachedHint)} <button type="button" class="btn btn-link btn-compact" data-slide-refresh-match>${escapeHtml(COPY.baselineSlideCachedRefresh)}</button></p>`
    : '';
  const poolHint = Number(data.matcherPoolSize) > 0
    ? `<p class="gov-baseline-pool-hint gov-inbox-hint" data-testid="gov-baseline-matcher-pool">${escapeHtml(String(data.matcherPoolSize))} Jira epics searched for match</p>`
    : `<p class="gov-baseline-pool-warn gov-inbox-hint" role="alert" data-testid="gov-baseline-matcher-pool-empty">${escapeHtml(COPY.baselineSlidePoolEmpty)}</p>`;
  const listHtml = `
    ${cachedBanner}
    ${poolHint}
    ${data.parseError ? `<p class="gov-inbox-hint">${escapeHtml(data.parseError)}</p>` : ''}
    <ul class="gov-baseline-extracted">${extracted}</ul>
    ${dupReview ? `<p class="gov-inbox-hint">${escapeHtml(COPY.baselineSlideDupReview)}</p><div class="gov-baseline-list" data-testid="gov-baseline-dup-review">${dupReview}</div>` : ''}
    ${unmatched ? `<p class="gov-inbox-hint">From slide — not in Jira yet:</p><div class="gov-baseline-list" data-testid="gov-baseline-unmatched">${unmatched}</div>` : ''}
    ${rows ? `<p class="gov-inbox-hint">Ready to confirm:</p><div class="gov-baseline-list" data-testid="gov-baseline-matched">${rows}</div>` : ''}`;
  return renderBaselineWizardShell({
    mode: 'slide',
    data,
    projectsCsv,
    quarterLabel: data.inferredQuarter || quarterLabel,
    listHtml,
    showConfirm: hasConfirmable,
    showCreate: false,
    slideCollapsed: true,
    aiCapability,
    slideActionsHtml: renderSlideActionsBar(data, projectsCsv),
    contextOpts: {
      inferredSquad: data.inferredSquad || (String(projectsCsv).toUpperCase().includes('SD') ? 'DMS' : ''),
      inferredQuarter: data.inferredQuarter,
      slideScopeMismatch: data.slideScopeMismatch,
      commitmentCount: (data.extracted || []).length || data.extractionMeta?.commitmentCount || 0,
      cachedSquad: data.cached ? (data.inferredSquad || (String(projectsCsv).toUpperCase().includes('SD') ? 'DMS' : '')) : '',
      cachedUploadDate: data.cached && data._cachedAt ? formatHumanAge(new Date(data._cachedAt).toISOString()) : '',
    },
  });
}

export function renderCandidates(data, projectsCsv, quarterLabel, jiraHost = null, aiCapability = null) {
  const rows = (data.candidates || []).map((c, i) => candidateRow(c, i, jiraHost)).join('');
  const few = (data.candidates || []).length <= 3;
  return renderBaselineWizardShell({
    mode: 'candidates',
    data,
    projectsCsv,
    quarterLabel,
    listHtml: `<div class="gov-baseline-list">${rows}</div>`,
    showConfirm: true,
    slideCollapsed: true,
    stepsOpen: !few,
    aiCapability,
  });
}
