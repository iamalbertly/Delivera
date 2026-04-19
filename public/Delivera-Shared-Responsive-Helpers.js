/**
 * Shared responsive/layout helpers. SSOT for resolveResponsiveRowLimit.
 */

const MOBILE_BREAKPOINT_PX = 768;

/**
 * Returns row limit based on viewport: mobile limit when width <= 768px, else desktop limit.
 * @param {number} desktopLimit
 * @param {number} [mobileLimit=8]
 * @returns {number}
 */
export function resolveResponsiveRowLimit(desktopLimit, mobileLimit = 8) {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches ? mobileLimit : desktopLimit;
    }
  } catch (_) {}
  return desktopLimit;
}
