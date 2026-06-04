/**
 * Client SSOT: inbox fingerprint grouping (mirrors server).
 */
import { inboxItemFingerprint } from './Delivera-App-Governance-Inbox-01Fingerprint-SSOT.js';

export { inboxItemFingerprint };

export function groupInboxByFingerprint(items = []) {
  const map = new Map();
  for (const item of items) {
    const fp = inboxItemFingerprint(item);
    if (!map.has(fp)) {
      const p = item.payload || {};
      map.set(fp, {
        fingerprint: fp,
        type: item.type,
        owner: p.owner || p.assigneeName || p.decisionNeededFrom || 'Unassigned',
        board: p.board || item.projects?.[0] || '',
        riskType: p.riskType || p.reason || item.type,
        reason: p.reason || p.riskType || item.type,
        count: 0,
        ids: [],
        exampleItem: item,
      });
    }
    const g = map.get(fp);
    g.count += 1;
    g.ids.push(item.id);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
