/**
 * SSOT: Create Work button markup for governance + PI flows.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function firstProject(projectsCsv = '') {
  return String(projectsCsv || '').split(',').map((p) => p.trim()).filter(Boolean)[0] || '';
}

/**
 * @param {object} opts
 * @param {string} opts.projectsCsv
 * @param {string} [opts.prefill]
 * @param {string} [opts.label]
 * @param {string} [opts.testId]
 * @param {string} [opts.context]
 * @param {string} [opts.variant] btn-primary | btn-secondary
 */
export function renderCreateWorkButton({
  projectsCsv = '',
  prefill = '',
  label = '',
  testId = 'gov-create-work',
  context = 'Create promised work in Jira.',
  variant = 'btn-secondary',
} = {}) {
  const prefillAttr = prefill ? ` data-outcome-prefill="${escapeHtml(prefill)}"` : '';
  const pk = firstProject(projectsCsv);
  const projectAttr = pk ? ` data-outcome-project="${escapeHtml(pk)}"` : '';
  const text = label || (prefill ? COPY.baselineSlideCreateMissing : 'Create work');
  const classes = /\bbtn-compact\b/.test(variant) ? `btn ${variant}` : `btn ${variant} btn-compact`;
  return `<button type="button" class="${classes}" data-open-outcome-modal data-outcome-projects="${escapeHtml(projectsCsv)}" data-outcome-context="${escapeHtml(context)}"${projectAttr}${prefillAttr} data-testid="${escapeHtml(testId)}">${escapeHtml(text)}</button>`;
}
