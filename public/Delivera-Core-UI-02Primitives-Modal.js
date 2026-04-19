import { createOverlayController } from './Reporting-App-Shared-Overlay-Manager.js';

// Shared modal behavior primitive
export function createModalBehavior(modalSelector, opts = {}) {
  return createOverlayController(modalSelector, {
    ...opts,
    mode: opts.mode || 'modal',
  });
}
