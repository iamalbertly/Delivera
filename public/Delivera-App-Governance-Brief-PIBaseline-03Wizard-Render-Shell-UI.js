/**
 * PI baseline wizard — shell / empty / slide / candidates HTML.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { hasAiProviderKey } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
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
  const squad = opts.inferredSquad || ((pk === 'SD' || /dms/i.test(pk)) ? 'DMS' : pk);
  const quarter = opts.inferredQuarter || quarterLabel || 'Not set';
  const slideMismatch = Boolean(opts.slideScopeMismatch);
  const mismatchHint = slideMismatch
    ? `<p class="gov-baseline-squad-warn" data-testid="gov-baseline-squad-mismatch">${escapeHtml(COPY.baselineSquadMismatch)} <button type="button" class="btn btn-link btn-compact" data-baseline-switch-sd="1">Use SD (DMS)</button></p>`
    : '';
  return `
    <div class="gov-baseline-context" data-testid="gov-baseline-context">
      <span><strong>Project:</strong> ${escapeHtml(projects)}</span>
      <span><strong>Squad:</strong> ${escapeHtml(squad)}</span>
      <span><strong>Quarter:</strong> ${escapeHtml(quarter)}</span>
      <p class="gov-baseline-context-why">${escapeHtml(COPY.piBaselineWhy)}</p>
      ${mismatchHint}
    </div>`;
}

export function slideUploadInner(serverAiStatus = null) {
  const serverReady = Boolean(serverAiStatus?.slideVisionReady) && !hasAiProviderKey();
  const keyHint = (!serverReady && !hasAiProviderKey())
    ? `<p class="gov-inbox-hint gov-baseline-ai-hint" data-ai-key-hint="1">${escapeHtml(COPY.aiKeyRequiredSlide)} <a href="/settings?return=/governance&amp;openAlignment=slide">Settings</a></p>`
    : '';
  const serverHint = serverReady
    ? `<p class="gov-inbox-hint gov-baseline-ai-hint gov-baseline-ai-hint--ready" data-ai-server-ready="1">${escapeHtml(COPY.aiSlideServerReady.replace('{label}', serverAiStatus?.label || 'server'))}</p>`
    : '';
  return `
    <label class="gov-baseline-slide-drop" id="gov-baseline-slide-drop">
      <span>${escapeHtml(COPY.baselineSlideUpload)}</span>
      <span class="gov-baseline-slide-hint">Drag &amp; drop or click</span>
      <input type="file" id="gov-baseline-slide-input" accept="image/png,image/jpeg,image/webp" />
    </label>
    ${serverHint}${keyHint}`;
}

export function slideUploadOptional(collapsed = true, serverAiStatus = null) {
  return `
    <details class="gov-baseline-optional"${collapsed ? '' : ' open'}>
      <summary>${escapeHtml(COPY.piBaselineOptionalSlide)}</summary>
      ${slideUploadInner(serverAiStatus)}
    </details>`;
}

export function renderLoading() {
  return `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineLoading)}</p>`;
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
  const reviewBtn = narrative && missingN === 0 && !receipt?.failed
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
  serverAiStatus = null,
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
  const slideBlock = mode === 'empty' ? slideUploadOptional(false, serverAiStatus) : slideUploadOptional(slideCollapsed, serverAiStatus);
  const refreshListBtn = mode === 'candidates' || mode === 'slide'
    ? `<button type="button" class="btn btn-link btn-compact" id="gov-baseline-refresh-list">${escapeHtml(COPY.refreshBrief)} list</button>`
    : '';

  return `
    <div class="gov-baseline-wizard" data-propose-method="${escapeHtml(data.method || 'manual')}">
      ${renderContextBanner(projectsCsv, contextOpts.inferredQuarter || quarterLabel, contextOpts)}
      <p class="gov-baseline-wizard-title">${escapeHtml(title)}</p>
      ${renderStepsFold(stepsOpen || mode === 'empty')}
      ${hint ? `<p class="gov-inbox-hint">${escapeHtml(hint)}</p>` : ''}
      ${mode === 'candidates' || mode === 'slide' ? fewItemsBanner(data) : ''}
      ${listHtml}
      ${slideActionsHtml}
      ${slideBlock}
      <div class="gov-baseline-actions">
        ${createBtn}
        ${confirmBtn}
        ${refreshBtn}
        ${refreshListBtn}
        ${jiraBtn}
        <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button>
      </div>
    </div>`;
}

export function renderEmpty(data, jiraUrl, projectsCsv, quarterLabel, partial = false, errorHint = '', serverAiStatus = null) {
  return renderBaselineWizardShell({
    mode: 'empty',
    data,
    projectsCsv,
    quarterLabel,
    extraHint: errorHint || resolveHint(data, partial),
    showRefresh: true,
    showCreate: false,
    jiraUrl,
    stepsOpen: true,
    slideCollapsed: false,
    serverAiStatus,
  });
}

export function renderSlideReview(data, projectsCsv, quarterLabel, jiraHost = null, serverAiStatus = null) {
  const extracted = (data.extracted || []).slice(0, 12).map((r) => `
    <li>${escapeHtml([r.month, r.theme, r.bullet].filter(Boolean).join(' · '))}</li>`).join('');
  // Prefer candidates that are confirmable; unmatched holds missing / dup-risk for actions
  const unmatched = (data.unmatched || []).map((c, i) => candidateRow(c, `u-${i}`, jiraHost)).join('');
  const confirmable = (data.candidates || []).filter((c) => c.issueKey && c.method !== 'slide-duplicate-risk');
  const rows = confirmable.map((c, i) => candidateRow(c, i, jiraHost)).join('');
  // Keep full candidates list for save (index into confirmable clone stored on data)
  data._confirmable = confirmable;
  const hasConfirmable = confirmable.length > 0 && !data.createReceipt?.failed;
  const listHtml = `
    ${data.parseError ? `<p class="gov-inbox-hint">${escapeHtml(data.parseError)}</p>` : ''}
    <ul class="gov-baseline-extracted">${extracted}</ul>
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
    serverAiStatus,
    slideActionsHtml: renderSlideActionsBar(data, projectsCsv),
    contextOpts: {
      inferredSquad: data.inferredSquad,
      inferredQuarter: data.inferredQuarter,
      slideScopeMismatch: data.slideScopeMismatch,
    },
  });
}

export function renderCandidates(data, projectsCsv, quarterLabel, jiraHost = null, serverAiStatus = null) {
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
    serverAiStatus,
  });
}
