/**
 * SSOT: inbox fingerprint key (browser + server via Node import from public/).
 */

export function inboxItemFingerprint(item = {}) {
  const p = item.payload || {};
  const owner = String(p.owner || p.assigneeName || p.decisionNeededFrom || '').trim();
  const board = String(p.board || item.projects?.[0] || '').trim().toUpperCase();
  const riskType = String(p.riskType || p.reason || '').trim();
  return `${item.type || 'item'}:${owner}:${riskType}:${board}`;
}

export function isSyntheticInboxId(id) {
  const s = String(id || '');
  return s.startsWith('synthetic-') || s === 'synthetic-cached-brief';
}
