/**
 * Client fetch helpers — surface API errors without silent console-only failures.
 */

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function showInlineToast(host, message, kind = 'error') {
  if (!host) return;
  let el = host.querySelector('.gov-inline-toast');
  if (!el) {
    el = document.createElement('p');
    el.className = `gov-inline-toast gov-inline-toast--${kind}`;
    el.setAttribute('role', 'alert');
    host.prepend(el);
  }
  el.textContent = message;
  el.hidden = false;
  window.setTimeout(() => { el.hidden = true; }, 4000);
}
