/**
 * Shared tab strip activation — evidence page tabs and drawer tabs.
 */
export const GOV_DRAWER_TAB_KEY = 'gov-drawer-active-tab';
export const GOV_EVIDENCE_TAB_KEY = 'gov-evidence-active-tab';

export function readStoredTab(storageKey, validKeys, fallback = 'proof') {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved && validKeys.includes(saved)) return saved;
  } catch (_) { /* ignore */ }
  return fallback;
}

export function activateTabStrip(root, { tabAttr, panelAttr, activeKey }) {
  if (!root || !activeKey) return;
  root.querySelectorAll(`[${tabAttr}]`).forEach((tab) => {
    const on = tab.getAttribute(tabAttr) === activeKey;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  root.querySelectorAll(`[${panelAttr}]`).forEach((panel) => {
    const on = panel.getAttribute(panelAttr) === activeKey;
    panel.classList.toggle('is-active', on);
    if ('hidden' in panel) panel.hidden = !on;
  });
}

export function bindTabStrip(root, { tabAttr, panelAttr, storageKey, validKeys, defaultKey = 'proof' }) {
  if (!root) return;
  const tabs = root.querySelectorAll(`[${tabAttr}]`);
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute(tabAttr);
      if (!key || !validKeys.includes(key)) return;
      activateTabStrip(root, { tabAttr, panelAttr, activeKey: key });
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, key); } catch (_) { /* ignore */ }
      }
    });
  });
  const initial = readStoredTab(storageKey, validKeys, defaultKey);
  activateTabStrip(root, { tabAttr, panelAttr, activeKey: initial });
  return initial;
}
