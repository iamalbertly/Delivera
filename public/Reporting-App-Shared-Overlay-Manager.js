const OVERLAY_OPEN_CLASS = 'app-overlay-open';
const OVERLAY_BODY_LOCK_CLASS = 'app-overlay-body-lock';

let activeOverlayId = '';
let activeBackdrop = null;
let activeFocusReturnEl = null;

function ensureBackdrop() {
  if (activeBackdrop) return activeBackdrop;
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'app-overlay-backdrop';
  backdrop.setAttribute('aria-label', 'Close overlay');
  backdrop.tabIndex = -1;
  backdrop.hidden = true;
  document.body.appendChild(backdrop);
  activeBackdrop = backdrop;
  return backdrop;
}

function findFocusable(root) {
  if (!root) return null;
  return root.querySelector('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
}

function closeActiveOverlay({ returnFocus = true } = {}) {
  if (!activeOverlayId) return;
  const overlay = document.getElementById(activeOverlayId);
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (overlay.dataset.overlayMode === 'drawer') overlay.hidden = true;
  }
  const backdrop = ensureBackdrop();
  backdrop.hidden = true;
  backdrop.classList.remove('is-open');
  document.body.classList.remove(OVERLAY_OPEN_CLASS, OVERLAY_BODY_LOCK_CLASS);
  const returnEl = activeFocusReturnEl;
  activeOverlayId = '';
  activeFocusReturnEl = null;
  if (returnFocus && returnEl && typeof returnEl.focus === 'function') {
    window.setTimeout(() => returnEl.focus(), 10);
  }
}

function openOverlay(overlay, { mode = 'modal', returnFocusEl = null } = {}) {
  if (!overlay) return;
  if (activeOverlayId && activeOverlayId !== overlay.id) closeActiveOverlay({ returnFocus: false });
  const backdrop = ensureBackdrop();
  overlay.dataset.overlayMode = mode;
  overlay.hidden = false;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  backdrop.classList.add('is-open');
  document.body.classList.add(OVERLAY_OPEN_CLASS, OVERLAY_BODY_LOCK_CLASS);
  activeOverlayId = overlay.id;
  activeFocusReturnEl = returnFocusEl || document.activeElement;
  const focusEl = findFocusable(overlay);
  if (focusEl && typeof focusEl.focus === 'function') {
    window.setTimeout(() => focusEl.focus(), 20);
  }
}

function wireGlobalHandlers() {
  if (document.body.dataset.overlayManagerWired === '1') return;
  document.body.dataset.overlayManagerWired = '1';
  const backdrop = ensureBackdrop();
  backdrop.addEventListener('click', () => closeActiveOverlay());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeOverlayId) {
      event.preventDefault();
      closeActiveOverlay();
    }
  });
  document.addEventListener('click', (event) => {
    const closeTrigger = event.target?.closest?.('[data-overlay-close]');
    if (!closeTrigger) return;
    closeActiveOverlay();
  });
}

export function initOverlayManager() {
  if (typeof document === 'undefined' || !document.body) return;
  wireGlobalHandlers();
}

export function createOverlayController(overlaySelector, options = {}) {
  initOverlayManager();
  const overlay = typeof overlaySelector === 'string'
    ? document.querySelector(overlaySelector)
    : overlaySelector;
  if (!overlay || !overlay.id) {
    return { open: () => {}, close: () => {}, destroy: () => {} };
  }

  const mode = options.mode || overlay.dataset.overlayMode || 'modal';
  const originalDisplay = overlay.style.display;

  const open = ({ triggerEl = null } = {}) => {
    if (typeof options.onOpen === 'function') options.onOpen();
    if (mode === 'drawer') overlay.hidden = false;
    if (originalDisplay === 'none') overlay.style.display = '';
    openOverlay(overlay, { mode, returnFocusEl: triggerEl || document.activeElement });
  };

  const close = ({ returnFocus = true } = {}) => {
    if (activeOverlayId === overlay.id) {
      closeActiveOverlay({ returnFocus });
    } else {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (mode === 'drawer') overlay.hidden = true;
    }
    if (typeof options.onClose === 'function') options.onClose();
  };

  const clickHandler = (event) => {
    if (event.target === overlay || event.target?.closest?.('[data-modal-close], .modal-close-btn, [data-overlay-close]')) {
      close();
    }
  };

  overlay.addEventListener('click', clickHandler);
  overlay.dataset.overlayMode = mode;
  overlay.setAttribute('aria-hidden', overlay.classList.contains('is-open') ? 'false' : 'true');

  return {
    open,
    close,
    destroy: () => {
      overlay.removeEventListener('click', clickHandler);
      if (activeOverlayId === overlay.id) closeActiveOverlay({ returnFocus: false });
    },
  };
}

export function isOverlayOpen(overlayId) {
  return activeOverlayId === overlayId;
}

export function closeOverlayById(overlayId) {
  if (activeOverlayId === overlayId) closeActiveOverlay();
}
