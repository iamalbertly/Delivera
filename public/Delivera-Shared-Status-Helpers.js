export function setErrorOnEl(el, msg) {
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg || 'An error occurred.';
  // Accessibility: announce errors to assistive tech
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
}

export function setActionErrorOnEl(el, options = {}) {
  if (!el) return;
  const title = options.title || 'Something went wrong';
  const message = options.message || 'Please try again.';
  const primaryLabel = options.primaryLabel || 'Retry';
  const primaryAction = options.primaryAction || 'retry-last-intent';
  const secondaryAction = options.secondaryAction || '';
  const secondaryActionLabel = options.secondaryActionLabel || '';
  const secondaryHref = options.secondaryHref || '';
  const secondaryLabel = options.secondaryLabel || '';
  const dismissible = options.dismissible !== false;
  el.style.display = 'block';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  const secondaryActionHtml = secondaryAction && secondaryActionLabel
    ? `<button type="button" class="btn btn-secondary btn-compact" data-action="${String(secondaryAction)}">${String(secondaryActionLabel)}</button>`
    : '';
  const primaryHtml = primaryAction && primaryLabel
    ? `<button type="button" class="btn btn-secondary btn-compact" data-action="${String(primaryAction)}">${String(primaryLabel)}</button>`
    : '';
  const secondaryHtml = secondaryHref && secondaryLabel
    ? `<a class="btn btn-secondary btn-compact" href="${String(secondaryHref)}">${String(secondaryLabel)}</a>`
    : '';
  const dismissHtml = dismissible
    ? '<button type="button" class="error-close" data-action="dismiss-error" aria-label="Dismiss">x</button>'
    : '';
  el.innerHTML = `
    <div class="status-banner warning">
      <div class="status-banner-message"><strong>${String(title)}</strong> ${String(message)}</div>
      <div class="status-banner-actions">
        ${primaryHtml}
        ${secondaryActionHtml}
        ${secondaryHtml}
      </div>
      ${dismissHtml}
    </div>
  `;
}

export function setLoadingOnEl(el, msg) {
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg || 'Loading...';
  // ensure loading is not announced as an error
  el.removeAttribute('role');
  el.setAttribute('aria-live', 'polite');
}

export function clearEl(el) {
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
  el.removeAttribute('role');
  el.removeAttribute('aria-live');
}

