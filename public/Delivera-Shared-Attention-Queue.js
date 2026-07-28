import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function dedupeTableItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item) return false;
    const key = item.dedupeKey || `${item.issue || ''}:${item.reason || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map sprint cockpit risks to attention queue rows. */
export function cockpitRisksToAttentionItems(topRisks = []) {
  return (Array.isArray(topRisks) ? topRisks : []).map((r) => {
    const tags = Array.isArray(r.riskTags) ? r.riskTags : [];
    const ownerMissing = tags.includes('unassigned')
      || /unassigned|no owner|owner route missing|unowned/i.test(String(r.assignee || r.owner || r.decisionNeededFrom || ''));
    return {
      issue: r.issueKey || r.label || 'Sprint',
      reason: r.label || r.reason || 'Needs attention',
      owner: r.owner || r.decisionNeededFrom || r.assignee || 'Scrum Master',
      nextMove: r.action || r.recommendedAction || '',
      proof: r.evidence || r.detail || '',
      dedupeKey: r.issueKey ? String(r.issueKey).toUpperCase() : `cockpit:${r.label}`,
      tone: r.tone === 'critical' ? 'critical' : r.tone === 'warning' ? 'warning' : '',
      issueKey: r.issueKey || '',
      assignInline: ownerMissing && Boolean(r.issueKey),
      riskTags: tags,
    };
  });
}

/** Map governance brief risks to attention queue rows. */
export function risksToAttentionItems(brief) {
  const risks = [
    ...(brief?.portfolioRisks || []),
    ...(brief?.topRisks || []),
  ];
  const seen = new Set();
  const out = [];
  for (const r of risks) {
    const issue = r.issueKey || r.squad || 'Portfolio';
    const key = r.issueKey ? String(r.issueKey).toUpperCase() : `sq:${r.squad}:${r.riskType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      issue,
      reason: r.riskLabel || r.riskType || 'Needs attention',
      owner: r.decisionNeededFrom || 'Scrum Master',
      nextMove: r.recommendedAction || '',
      proof: r.evidence || '',
      dedupeKey: key,
      tone: r.escalation === 'escalate' ? 'critical' : r.escalation === 'act-today' ? 'warning' : '',
    });
  }
  return out;
}

export function renderAttentionQueueTable({ title = 'Attention queue', items = [], maxRows = 8 } = {}) {
  const safeItems = dedupeTableItems(items);
  if (!safeItems.length) return '';
  const body = safeItems.slice(0, maxRows).map((item) => {
    const nextMoveCell = item.assignInline
      ? `<button type="button" class="btn btn-secondary btn-compact" data-attention-assign="${escapeHtml(item.issueKey)}" data-risk-tags="unassigned">Assign</button>`
      : escapeHtml(item.nextMove);
    return `
    <tr data-risk-tags="${escapeHtml((item.riskTags || []).join(' '))}" data-issue-key="${escapeHtml(item.issueKey || item.issue || '')}">
      <td data-label="Issue">${escapeHtml(item.issue)}</td>
      <td data-label="Reason">${escapeHtml(item.reason)}</td>
      <td data-label="Owner">${escapeHtml(item.owner)}</td>
      <td data-label="Next move">${nextMoveCell}</td>
      <td data-label="Proof">${escapeHtml(item.proof)}</td>
    </tr>`;
  }).join('');
  return `
    <section class="attention-queue attention-queue--table" aria-label="${escapeHtml(title)}">
      <h2 class="governance-section-title">${escapeHtml(title)}</h2>
      <div class="data-table-scroll-wrap attention-queue-table-wrap">
        <table class="attention-queue-table">
          <thead><tr><th>Issue</th><th>Reason</th><th>Owner</th><th>Next move</th><th>Proof</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

export function renderAttentionQueue({ title = 'Attention queue', items = [], compact = false } = {}) {
  const legacy = (Array.isArray(items) ? items : []).filter((i) => i?.label);
  if (legacy.length && !legacy[0]?.issue) {
    const seen = new Set();
    const safeItems = legacy.filter((item) => {
      const key = item.dedupeKey || `${item.tone || ''}:${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!safeItems.length) return '';
    const rows = safeItems.slice(0, compact ? 3 : 5).map((item) => {
      const tone = item.tone ? ` attention-queue-item--${escapeHtml(item.tone)}` : '';
      const attrs = item.action ? ` data-attention-action="${escapeHtml(item.action)}"` : '';
      const tag = item.action ? 'button type="button"' : 'div';
      const sub = item.detail ? `<span class="attention-queue-item-detail">${escapeHtml(item.detail)}</span>` : '';
      return `<${tag} class="attention-queue-item${tone}"${attrs}><span class="attention-queue-item-label">${escapeHtml(item.label)}</span>${sub}</${item.action ? 'button' : 'div'}>`;
    }).join('');
    const titleHtml = title ? `<div class="attention-queue-title">${escapeHtml(title)}</div>` : '';
    return `<section class="attention-queue${compact ? ' attention-queue--compact' : ''}" aria-label="${escapeHtml(title || 'Attention queue')}">${titleHtml}<div class="attention-queue-list">${rows}</div></section>`;
  }
  return renderAttentionQueueTable({ title, items, maxRows: compact ? 3 : 8 });
}
