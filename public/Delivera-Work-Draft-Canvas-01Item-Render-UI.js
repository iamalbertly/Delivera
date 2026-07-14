import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export const TYPE_CYCLE = ['E', 'S', 'T', 'N', 'I'];
export const TYPE_LABELS = { E: 'Epic', S: 'Story', T: 'Task', N: 'Note', I: 'Ignore' };

export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function confidenceBand(confidence) {
  const c = Number(confidence ?? 1);
  if (c >= 0.7) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

export const ESTIMATE_SCALE = {
  hours: [null, 0.5, 1, 2, 4, 8, 16, 32],
  labels: ['—', '½h', '1h', '2h', '4h', '8h', '1d', '2d'],
  max: 7,
  spToStep: { 1: 2, 2: 3, 3: 3, 5: 4, 8: 5, 13: 6, 21: 7 },
};

export function hoursToStep(hours) {
  if (hours == null) return 0;
  const idx = ESTIMATE_SCALE.hours.indexOf(hours);
  return idx >= 0 ? idx : 0;
}

export function stepToLabel(step) { return ESTIMATE_SCALE.labels[step] || '—'; }
export function stepToHours(step) { return ESTIMATE_SCALE.hours[step] ?? null; }

export function autoSuggestEstimate(title) {
  const t = String(title || '').toLowerCase();
  if (/\b(validate|verify|check|test)\b/.test(t)) return 2;
  if (/\b(implement|build|create|develop|write)\b/.test(t)) return 4;
  if (/\b(deploy|configure|setup|install)\b/.test(t)) return 1;
  if (/\b(migrate|refactor|redesign|rewrite)\b/.test(t)) return 8;
  if (/\b(fix|patch|hotfix|repair)\b/.test(t)) return 2;
  if (/\b(reload|re-load|sync|load|re-validate)\b/.test(t)) return 1;
  return null;
}

export function renderEstimateSlider(item) {
  if (item.type === 'I' || item.type === 'N') return '';
  const step = hoursToStep(item.estimateHours);
  const label = stepToLabel(step);
  const hasEst = step > 0;
  const fillPct = Math.round((step / ESTIMATE_SCALE.max) * 100);
  return `<div class="wdc-estimate-slider-wrap" data-has-estimate="${hasEst}" data-estimate-item="${esc(item.id)}" style="--filled:${fillPct}%" title="Drag to set estimate">
  <input type="range" class="wdc-estimate-slider" min="0" max="${ESTIMATE_SCALE.max}" step="1" value="${step}" data-estimate-for="${esc(item.id)}" aria-label="Estimate hours" aria-valuetext="${esc(label)}" />
  <span class="wdc-estimate-slider-label">${esc(label)}</span>
</div>`;
}

export function buildRepairHtml(item, ctx) {
  const items = ctx?.items || [];
  const parts = [];

  if (item.acceptedAssignee) {
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--assignee-accepted" title="Assignee confirmed">Assigned: ${esc(item.acceptedAssignee)}</span>`);
  } else if (item.suggestedAssignee) {
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--assignee" title="Based on who worked on similar items in this board">Suggested: ${esc(item.suggestedAssignee)}</span>`
      + `<button class="wdc-repair-action" data-repair="accept-assignee" data-item-id="${esc(item.id)}" data-assignee="${esc(item.suggestedAssignee)}">Use</button>`);
  }

  if (item.duplicate?.suggestedAction === 'skipAlreadyDone') {
    const dk = item.duplicate.key || '';
    const score = item.duplicate.similarity != null ? ` · ${esc(String(item.duplicate.similarity))}% match` : '';
    const jiraUrl = item.duplicate.url || '';
    const keyChip = jiraUrl
      ? `<a class="wdc-repair-chip wdc-repair-chip--done-block" href="${esc(jiraUrl)}" target="_blank" rel="noopener noreferrer" title="View in Jira — this work is already Done">Already done: ${esc(dk)}${score}</a>`
      : `<span class="wdc-repair-chip wdc-repair-chip--done-block" title="This work is already in your Done column">Already done: ${esc(dk)}${score}</span>`;
    parts.push(keyChip
      + `<button class="wdc-repair-action" data-repair="link-dup" data-item-id="${esc(item.id)}" data-dup-key="${esc(dk)}">Link</button>`
      + `<button class="wdc-repair-action wdc-repair-action--secondary" data-repair="create-anyway" data-item-id="${esc(item.id)}">Create anyway</button>`
      + `<button class="wdc-repair-action" data-repair="ignore-dup" data-item-id="${esc(item.id)}">Skip</button>`);
  } else if (item.duplicate?.key && item.duplicate?.suggestedAction !== 'createNew' && item.duplicate?.suggestedAction !== 'reviewSimilar') {
    const dk = esc(item.duplicate.key);
    const dscore = item.duplicate.similarity != null ? ` · ${esc(String(item.duplicate.similarity))}% match` : '';
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--dupe">Similar: ${dk}${dscore}</span>`
      + `<button class="wdc-repair-action" data-repair="link-dup" data-item-id="${esc(item.id)}" data-dup-key="${dk}">Link</button>`
      + `<button class="wdc-repair-action" data-repair="create-new" data-item-id="${esc(item.id)}">Create new</button>`
      + `<button class="wdc-repair-action" data-repair="ignore-dup" data-item-id="${esc(item.id)}">Ignore</button>`);
  } else if (item.duplicate?.suggestedAction === 'reviewSimilar' && item.duplicate?.key) {
    const dk = esc(item.duplicate.key);
    const dscore = item.duplicate.similarity != null ? ` · ${esc(String(item.duplicate.similarity))}% match` : '';
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--fuzzy" title="Similar item exists but not a definite match">Review: ${dk}${dscore}</span>`
      + `<button class="wdc-repair-action" data-repair="ignore-dup" data-item-id="${esc(item.id)}">Dismiss</button>`);
  }

  item.warnings.forEach((w) => {
    const wl = String(w).toLowerCase();
    if (wl.includes('parent') || wl.includes('parent unclear')) {
      const suggested = items.find((i) => i.depth === 0 && i.id !== item.id);
      const groupLabel = suggested ? `Group under "${String(suggested.title).slice(0, 30)}"` : 'Group under parent';
      parts.push(`<span class="wdc-repair-chip wdc-repair-chip--warn">Parent unclear</span>`
        + (suggested ? `<button class="wdc-repair-action" data-repair="group-under" data-item-id="${esc(item.id)}" data-target-id="${esc(suggested.id)}">${esc(groupLabel)}</button>` : '')
        + `<button class="wdc-repair-action" data-repair="make-parent" data-item-id="${esc(item.id)}">Make parent</button>`
        + `<button class="wdc-repair-action" data-repair="ignore-item" data-item-id="${esc(item.id)}">Ignore</button>`);
    } else if (wl.includes('duplicate') || wl.includes('similar')) {
      parts.push(`<span class="wdc-repair-chip wdc-repair-chip--dupe">${esc(w)}</span>`);
    } else if (wl.includes('note') || wl.includes('non-work')) {
      parts.push(`<span class="wdc-repair-chip wdc-repair-chip--info">Looks like note</span>`
        + `<button class="wdc-repair-action" data-repair="mark-note" data-item-id="${esc(item.id)}">Mark as note</button>`
        + `<button class="wdc-repair-action" data-repair="keep-story" data-item-id="${esc(item.id)}">Keep as story</button>`);
    } else {
      parts.push(`<span class="wdc-repair-chip wdc-repair-chip--warn" title="${esc(w)}">${esc(w.length > 60 ? w.slice(0, 57) + '…' : w)}</span>`);
    }
  });

  return parts.join('');
}

export function renderItem(item, ctx) {
  const focusedItemId = ctx?.focusedItemId || '';
  const isDoneDuplicate = typeof ctx?.isDoneDuplicate === 'function' ? ctx.isDoneDuplicate : () => false;
  const repairHtml = buildRepairHtml(item, ctx);
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const nextType = TYPE_CYCLE[(TYPE_CYCLE.indexOf(item.type) + 1) % TYPE_CYCLE.length];
  const nextLabel = TYPE_LABELS[nextType] || nextType;
  return `<div class="wdc-item${item.type === 'I' ? ' is-ignored' : ''}${focusedItemId === item.id ? ' is-focused' : ''}"
    data-item-id="${esc(item.id)}"
    data-confidence="${confidenceBand(item.confidence)}"
    data-done-dup="${isDoneDuplicate(item) ? 'true' : 'false'}"
    style="--wdc-depth:${item.depth}"
    role="listitem">
  <button class="wdc-type-chip" data-type="${esc(item.type)}" title="${esc(typeLabel)} — click to change to ${esc(nextLabel)}" aria-label="Item type: ${esc(typeLabel)}">${esc(item.type)}</button>
  <div class="wdc-item-body">
    <div class="wdc-title-row">
      <input type="text" class="wdc-title" value="${esc(item.title)}" placeholder="Add title…" aria-label="Work item title" spellcheck="true" />
      ${item.suggestedStoryPoints != null ? `<span class="wdc-sp-badge" contenteditable="true" role="spinbutton" aria-label="Story points" title="Click to edit story points">${esc(String(item.suggestedStoryPoints))}<span class="wdc-sp-unit">pt</span></span>` : ''}
    </div>
    ${repairHtml ? `<div class="wdc-repairs">${repairHtml}</div>` : ''}
  </div>
  ${renderEstimateSlider(item)}
  <button class="wdc-item-menu-btn" title="More options" aria-label="More options for this item">⋮</button>
</div>`;
}

export function renderIgnoredFold(canvas, ignoredItems) {
  if (!ignoredItems?.length) return;
  const fold = document.createElement('div');
  fold.className = 'wdd-ignored-fold';
  const label = `${ignoredItems.length} line${ignoredItems.length === 1 ? '' : 's'} ignored as non-work`;
  fold.innerHTML = `<button class="wdd-ignored-fold-toggle" aria-expanded="false" data-action="toggle-ignored-fold">▸ ${esc(label)}</button>`
    + `<div class="wdd-ignored-fold-items" hidden>`
    + ignoredItems.map((item, idx) =>
      `<div class="wdd-ignored-fold-item"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.title)}</span><button class="wdd-ignored-restore-btn" data-restore-idx="${idx}">Restore</button></div>`
    ).join('')
    + `</div>`;
  canvas.appendChild(fold);
}
