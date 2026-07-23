import {
  COPY,
  businessTitleFromSummary,
  guidanceCodeToHint,
  humanEpicActivityLabel,
} from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function createWorkButton(projectsCsv) {
  return `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="Create promised work in Jira.">Create work</button>`;
}

function stepsFold(open = false) {
  return `<details class="gov-baseline-steps-fold"${open ? ' open' : ''}>
    <summary>How this works</summary><ol class="gov-baseline-steps">
      <li>${escapeHtml(COPY.baselineStep1)}</li><li>${escapeHtml(COPY.baselineStep2)}</li><li>${escapeHtml(COPY.baselineStep3)}</li>
    </ol></details>`;
}

function contextBanner(projectsCsv, quarterLabel) {
  const projects = projectsCsv.split(',').map((project) => project.trim()).filter(Boolean).join(', ') || '—';
  return `<div class="gov-baseline-context" data-testid="gov-baseline-context">
    <span><strong>Project:</strong> ${escapeHtml(projects)}</span>
    <span><strong>Quarter:</strong> ${escapeHtml(quarterLabel || 'Not set')}</span>
    <p class="gov-baseline-context-why">${escapeHtml(COPY.piBaselineWhy)}</p></div>`;
}

function fewItemsBanner(data) {
  const count = (data.candidates || []).length;
  if (count >= 3 && !(Number(data.totalBoardEpics) > count)) return '';
  return `<p class="gov-baseline-few-items" role="status">${escapeHtml(COPY.piBaselineFewItems.replace('{n}', String(count)))}</p>`;
}

function slideUpload() {
  return `<label class="gov-baseline-slide-drop" id="gov-baseline-slide-drop" tabindex="0">
    <span>${escapeHtml(COPY.baselineSlideUpload)}</span>
    <span class="gov-baseline-slide-hint">Image, PDF, or PowerPoint · drag, choose, or paste</span>
    <input type="file" id="gov-baseline-slide-input" accept="image/png,image/jpeg,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx" /></label>
    <p class="gov-inbox-hint gov-baseline-ai-hint gov-baseline-ai-hint--ready" data-ai-server-ready="1">Native extraction and local OCR run first. Shared AI is used only for unresolved evidence.</p>`;
}

function optionalSlide(collapsed) {
  return `<details class="gov-baseline-optional"${collapsed ? '' : ' open'}><summary>${escapeHtml(COPY.piBaselineOptionalSlide)}</summary>${slideUpload()}</details>`;
}

function candidateRow(candidate, index, jiraHost) {
  const canConfirm = Boolean(candidate.issueKey);
  const key = escapeHtml(candidate.issueKey || '');
  const keyLine = candidate.issueKey
    ? `<span class="gov-baseline-row-key">${jiraHost ? `<a href="${escapeHtml(jiraHost)}/browse/${key}" target="_blank" rel="noopener">${key}</a>` : key}</span>` : '';
  const activity = humanEpicActivityLabel(candidate.epicActivity || {});
  return `<label class="gov-baseline-row${canConfirm ? '' : ' gov-baseline-row--muted'}" data-testid="gov-baseline-row">
    <input type="checkbox" ${canConfirm && candidate.selected !== false ? 'checked' : ''} ${canConfirm ? '' : 'disabled'} data-candidate="${index}" />
    <span class="gov-baseline-row-body"><span class="gov-baseline-row-title">${escapeHtml(businessTitleFromSummary(candidate.title || candidate.summary || '', 200))}</span>
    ${keyLine}${activity ? `<span class="gov-baseline-activity">${escapeHtml(activity)}</span>` : ''}</span></label>`;
}

function resolveHint(data, partial = false) {
  if (data.guidanceCode) return guidanceCodeToHint(data.guidanceCode);
  if (data.guidance) return data.guidance;
  return partial ? COPY.baselineEmptyHintPartial : COPY.baselineEmptyHint;
}

function shell(options) {
  const { mode, data, projectsCsv, quarterLabel, errorHint = '', extraHint = '', listHtml = '' } = options;
  const title = mode === 'slide' ? COPY.baselineSlideMethod : mode === 'empty' ? COPY.baselineTitle : `${COPY.baselineConfirmTitle} (${(data.candidates || []).length})`;
  const hint = mode === 'candidates' || mode === 'slide' ? COPY.baselineConfirmHint : extraHint;
  return `<div class="gov-baseline-wizard" data-propose-method="${escapeHtml(data.method || 'manual')}">
    ${contextBanner(projectsCsv, quarterLabel)}<p class="gov-baseline-wizard-title">${escapeHtml(title)}</p>
    ${stepsFold(options.stepsOpen || mode === 'empty')}${errorHint ? `<p class="gov-baseline-error" role="alert" tabindex="-1">${escapeHtml(errorHint)}</p>` : ''}
    ${hint ? `<p class="gov-inbox-hint">${escapeHtml(hint)}</p>` : ''}${mode !== 'empty' ? fewItemsBanner(data) : ''}${listHtml}${optionalSlide(mode !== 'empty' && options.slideCollapsed !== false)}
    <div class="gov-baseline-actions">${options.showCreate ? createWorkButton(projectsCsv) : ''}
      ${options.showConfirm ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm" data-testid="gov-baseline-save">${escapeHtml(COPY.baselineConfirmBtn)}</button>` : ''}
      ${options.showRefresh ? `<button type="button" class="btn btn-primary btn-compact" id="gov-baseline-refresh">${escapeHtml(COPY.refreshBrief)}</button>` : ''}
      ${mode !== 'empty' ? `<button type="button" class="btn btn-link btn-compact" id="gov-baseline-refresh-list">${escapeHtml(COPY.refreshBrief)} list</button>` : ''}
      ${options.jiraUrl ? `<a class="btn btn-secondary btn-compact" href="${escapeHtml(options.jiraUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>` : ''}
      <button type="button" class="btn btn-link btn-compact" data-baseline-close>${escapeHtml(COPY.close)}</button></div></div>`;
}

export function baselineDrawerTitle(projectsCsv, quarterLabel) {
  const projects = projectsCsv.split(',').map((project) => project.trim()).filter(Boolean);
  return [COPY.piBaselineDrawerTitle, projects.length === 1 ? projects[0] : projects.join('+'), quarterLabel].filter(Boolean).join(' · ');
}

export function renderBaselineLoading() {
  return `<p class="gov-baseline-loading" aria-busy="true">${escapeHtml(COPY.baselineLoading)}</p>`;
}

export function renderBaselineEmpty(data, jiraUrl, projectsCsv, quarterLabel, partial = false, errorHint = '') {
  return shell({ mode: 'empty', data, projectsCsv, quarterLabel, extraHint: resolveHint(data, partial), errorHint, showRefresh: true, showCreate: true, jiraUrl, stepsOpen: true, slideCollapsed: false });
}

export function renderBaselineSlideReview(data, projectsCsv, quarterLabel, jiraHost) {
  const extracted = (data.extracted || []).slice(0, 12).map((row) => `<li>${escapeHtml([row.month, row.theme, row.bullet].filter(Boolean).join(' · '))}</li>`).join('');
  const unmatched = (data.unmatched || []).map((candidate, index) => candidateRow(candidate, `u-${index}`, jiraHost)).join('');
  const matched = (data.candidates || []).filter((candidate) => candidate.issueKey);
  const rows = matched.map((candidate, index) => candidateRow(candidate, index, jiraHost)).join('');
  const detected = (data.squads || []).map((item) => item.key).filter(Boolean).join(', ') || 'Needs review';
  const trust = `<div class="gov-baseline-trust-strip" role="status">
    <span><strong>Detected:</strong> ${escapeHtml(detected)}</span>
    <span><strong>Period:</strong> ${escapeHtml(data.period?.label || quarterLabel || 'Needs review')}</span>
    <span><strong>Evidence:</strong> ${escapeHtml(data.provenanceComplete ? 'Source-linked' : 'Review required')}</span>
    <span><strong>AI calls:</strong> ${Number(data.callsConsumed) || 0}${data.cached ? ' · cached' : ''}</span></div>`;
  const conflicts = (data.conflicts || []).map((item) => `<p class="gov-baseline-error" role="alert">Detected ${escapeHtml(item.detected)} conflicts with requested ${escapeHtml(item.requested)}. Confirm before saving.</p>`).join('');
  const listHtml = `${trust}${conflicts}<ul class="gov-baseline-extracted">${extracted}</ul>
    ${unmatched ? `<p class="gov-inbox-hint">From source — not in Jira yet:</p><div class="gov-baseline-list">${unmatched}</div>` : ''}<div class="gov-baseline-list">${rows}</div>`;
  const confirmable = matched.length > 0 && !(data.conflicts || []).length;
  return shell({ mode: 'slide', data, projectsCsv, quarterLabel, listHtml, showConfirm: confirmable, showCreate: !confirmable && Boolean(extracted || unmatched), slideCollapsed: true });
}

export function renderBaselineCandidates(data, projectsCsv, quarterLabel, jiraHost, _serverAiStatus, errorHint = '') {
  const rows = (data.candidates || []).map((candidate, index) => candidateRow(candidate, index, jiraHost)).join('');
  return shell({ mode: 'candidates', data, projectsCsv, quarterLabel, listHtml: `<div class="gov-baseline-list">${rows}</div>`, showConfirm: true, slideCollapsed: true, stepsOpen: (data.candidates || []).length <= 3, jiraHost, errorHint });
}
