import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderSharedLoadingState({
  message = 'Loading...',
  variant = 'spinner',
  compact = false,
} = {}) {
  const cls = [
    'delivera-loading-state',
    `delivera-loading-state--${variant}`,
    compact ? 'delivera-loading-state--compact' : '',
  ].filter(Boolean).join(' ');
  const lines = variant === 'skeleton'
    ? '<span></span><span></span><span></span>'
    : '<i aria-hidden="true"></i>';
  return `
    <div class="${escapeHtml(cls)}" aria-busy="true" role="status" data-delivera-loading-state="1">
      ${lines}
      <p>${escapeHtml(message)}</p>
    </div>`;
}

export function setSharedLoadingState(host, opts = {}) {
  if (!host) return;
  host.innerHTML = renderSharedLoadingState(opts);
}
