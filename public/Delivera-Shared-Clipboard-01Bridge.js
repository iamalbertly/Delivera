/**
 * SSOT: clipboard write with textarea fallback (HTTP / permission denied).
 */

export async function writeTextToClipboardWithFallback(text) {
  const payload = String(text ?? '');
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(payload);
      return { ok: true, method: 'clipboard-api' };
    } catch (_) { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = payload;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Clipboard copy unavailable');
  return { ok: true, method: 'execCommand' };
}

/**
 * @param {HTMLElement} mount
 * @param {string} text
 */
export function showClipboardFallbackSnippet(mount, text) {
  if (!mount) return;
  let box = mount.querySelector('.gov-copy-fallback-snippet');
  if (!box) {
    box = document.createElement('div');
    box.className = 'gov-copy-fallback-snippet';
    box.setAttribute('role', 'status');
    mount.appendChild(box);
  }
  box.innerHTML = `<p class="gov-copy-fallback-label">Select and copy:</p><textarea class="gov-copy-fallback-text" readonly rows="3">${text.replace(/</g, '&lt;')}</textarea>`;
  box.querySelector('textarea')?.select?.();
}
