import { parseOutcomeIntake, OUTCOME_STRUCTURE_MODE } from './Delivera-Shared-Outcome-Intake-Parser.js';
import { OUTCOME_ACTIVITY_LOG_KEY, PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_PROVIDER_SESSION_KEY = 'wdd_ai_provider_v1';
const LAST_PROJECT_KEY = 'report_last_outcome_project_v1';
const SUBMIT_TIMEOUT_MS = 45000;
const PARSE_DEBOUNCE_MS = 800;
const UNDO_STACK_LIMIT = 50;
const JIRA_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const MAX_NARRATIVE_CHARS = 8000;

const TYPE_CYCLE = ['E', 'S', 'T', 'N', 'I'];
const TYPE_LABELS = { E: 'Epic', S: 'Story', T: 'Task', N: 'Note', I: 'Ignore' };

// Map server/AI-returned type strings to canvas chip letters
const SERVER_TYPE_TO_CHIP = {
  Epic: 'E', Story: 'S', Task: 'T', Note: 'N', Ignore: 'I',
  EPIC: 'E', STORY: 'S', TASK: 'T', NOTE: 'N', IGNORE: 'I',
};

// ─── Module state ─────────────────────────────────────────────────────────────

let _config = {};
let _prefill = {};
/** @type {WorkItem[]} */
let _items = [];
/** @type {{ title: string, sourceLineIndex: number }[]} */
let _ignoredItems = [];
/** @type {WorkItem[][]} */
let _undoStack = [];
let _projectKey = '';
let _projectOptions = [];
let _focusedItemId = null;
let _isSubmitting = false;
let _isDraftLoading = false;
let _settingsOpen = false;
let _parseTimer = null;
let _showingReviewOnly = false;
let _jiraKeysDetected = [];
let _conflictState = null;

/**
 * @typedef {{ id: string, type: string, title: string, depth: number,
 *   confidence: number, warnings: string[], duplicate: object|null,
 *   sourceLineIndex: number, selected: boolean }} WorkItem
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function cloneItems(items) {
  return items.map((item) => ({ ...item, warnings: [...item.warnings] }));
}

function pushUndo() {
  _undoStack.push(cloneItems(_items));
  if (_undoStack.length > UNDO_STACK_LIMIT) _undoStack.shift();
}

function applyUndo() {
  if (!_undoStack.length) return;
  _items = _undoStack.pop();
  renderCanvas();
  updateSendBar();
}

function readProjectContextCsv() {
  try { return String(window.localStorage.getItem(PROJECTS_SSOT_KEY) || '').trim(); } catch (_) { return ''; }
}

function saveLastProject(key) {
  try { if (key) window.localStorage.setItem(LAST_PROJECT_KEY, key); } catch (_) {}
}

function readLastProject() {
  try { return window.localStorage.getItem(LAST_PROJECT_KEY) || ''; } catch (_) { return ''; }
}

function readAiProvider() {
  try { return JSON.parse(window.sessionStorage.getItem(AI_PROVIDER_SESSION_KEY) || 'null') || {}; } catch (_) { return {}; }
}

function saveAiProvider(data) {
  try { window.sessionStorage.setItem(AI_PROVIDER_SESSION_KEY, JSON.stringify(data)); } catch (_) {}
}

function getAllowedProjects(prefill = {}) {
  const selected = typeof _config.getSelectedProjects === 'function' ? (_config.getSelectedProjects() || []) : [];
  return Array.from(new Set([...selected, ...(prefill.contextProjects || [])].map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)));
}

function getDraftContext() {
  const fn = _config.getOutcomeDraftContext;
  if (typeof fn !== 'function') return { boardId: null, quarterHint: '' };
  try {
    const ctx = fn() || {};
    return { boardId: ctx.boardId != null ? Number(ctx.boardId) : null, quarterHint: String(ctx.quarterHint || ctx.quarterLabel || '').trim() };
  } catch (_) { return { boardId: null, quarterHint: '' }; }
}

function persistActivity(payload, projectKey) {
  try {
    const created = extractCreatedIssues(payload);
    if (!created.length) return;
    const raw = window.localStorage.getItem(OUTCOME_ACTIVITY_LOG_KEY);
    const current = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
    const entry = { at: new Date().toISOString(), projectKey: String(projectKey || '').toUpperCase(), contextProjects: readProjectContextCsv(), created };
    window.localStorage.setItem(OUTCOME_ACTIVITY_LOG_KEY, JSON.stringify([entry, ...current].slice(0, 20)));
  } catch (_) {}
}

function extractCreatedIssues(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const fromList = Array.isArray(payload.createdIssues) ? payload.createdIssues : (Array.isArray(payload.issues) ? payload.issues : []);
  const list = [];
  fromList.forEach((item) => {
    const key = String(item?.key || item?.issueKey || '').trim();
    const url = String(item?.url || item?.issueUrl || '').trim();
    if (key || url) list.push({ key, url });
  });
  const fbKey = String(payload.key || payload.issueKey || '').trim();
  const fbUrl = String(payload.url || payload.issueUrl || '').trim();
  if (fbKey || fbUrl) list.push({ key: fbKey, url: fbUrl });
  const seen = new Set();
  return list.filter((item) => { const sig = `${item.key}|${item.url}`; if (seen.has(sig)) return false; seen.add(sig); return true; });
}

async function postWithTimeout(url, body, extraHeaders = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  const ai = readAiProvider();
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (ai.provider && ai.provider !== 'built-in') {
    headers['x-ai-provider'] = ai.provider;
    if (ai.key) headers['x-ai-key'] = ai.key;
    if (ai.host) headers['x-ai-host'] = ai.host;
  }
  try {
    return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Request timed out after ${SUBMIT_TIMEOUT_MS / 1000}s. Check your network connection and Jira session, then retry.`);
    throw err;
  } finally { clearTimeout(t); }
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function drawer() { return document.getElementById('work-draft-drawer'); }

// ─── Drawer DOM creation ──────────────────────────────────────────────────────

function ensureDrawer() {
  if (document.getElementById('work-draft-drawer')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'work-draft-backdrop';
  document.body.appendChild(backdrop);

  const el = document.createElement('div');
  el.id = 'work-draft-drawer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Create work draft');
  el.innerHTML = `
<div class="wdd-header">
  <div style="position:relative">
    <button class="wdd-project-chip" id="wdd-project-chip" aria-haspopup="true" aria-expanded="false" title="Change project">
      <span id="wdd-project-label">Project</span> ▾
    </button>
    <div class="wdd-project-popover" id="wdd-project-popover" hidden></div>
  </div>
  <span class="wdd-title">Create work</span>
  <button class="wdd-settings-btn" id="wdd-settings-btn" aria-label="AI provider settings" title="AI provider settings">⚙</button>
  <button class="wdd-close-btn" id="wdd-close-btn" aria-label="Close">✕</button>
</div>
<div class="wdd-trust-strip" id="wdd-trust-strip">
  Draft only · No existing Jira issues will be changed · Undo available before send
</div>
<div class="wdd-body" id="wdd-body">
  <div class="wdd-source is-open" id="wdd-source">
    <button class="wdd-source-toggle" id="wdd-source-toggle" aria-label="Toggle source text">▲ Source</button>
    <textarea class="wdd-source-textarea" id="wdd-source-textarea" rows="5"
      placeholder="Paste your goals, brain dump, or meeting notes — AI will structure them into Jira work items based on your project's history."
      aria-label="Narrative source text"
      spellcheck="true"></textarea>
  </div>
  <div class="wdd-parse-status" id="wdd-parse-status" hidden></div>
  <div class="wdd-capacity-hint" id="wdd-capacity-hint" hidden></div>
  <div class="wdd-canvas" id="wdd-canvas" role="list" aria-label="Work items" tabindex="0"></div>
  <div class="wdd-follow-up" id="wdd-follow-up" hidden></div>
</div>
<div class="wdd-safe-send-bar" id="wdd-safe-send-bar">
  <div class="wdd-send-counts" id="wdd-send-counts"></div>
  <div class="wdd-send-actions" id="wdd-send-actions">
    <button class="wdd-create-safe-btn" id="wdd-create-safe-btn" disabled>Create 0 issues</button>
    <button class="wdd-review-btn" id="wdd-review-btn" hidden>Review warnings</button>
  </div>
  <div class="wdd-submit-status" id="wdd-submit-status" aria-live="polite"></div>
</div>
`;
  document.body.appendChild(el);
}

// ─── Open / close ─────────────────────────────────────────────────────────────

export function openWorkDraftDrawer(prefill = {}) {
  ensureDrawer();
  _prefill = prefill || {};
  _items = [];
  _ignoredItems = [];
  _undoStack = [];
  _showingReviewOnly = false;
  _settingsOpen = false;
  _jiraKeysDetected = [];
  _conflictState = null;

  const projects = getAllowedProjects(_prefill);
  _projectOptions = projects;
  _projectKey = String(_prefill.preferredProject || readLastProject() || projects[0] || '').trim().toUpperCase();
  if (!_projectKey && projects.length) _projectKey = projects[0];

  updateProjectChip();
  updateTrustStrip();

  const ta = document.getElementById('wdd-source-textarea');
  if (ta) ta.value = String(_prefill.narrative || '').trim();

  const followUp = document.getElementById('wdd-follow-up');
  if (followUp) { followUp.hidden = true; followUp.innerHTML = ''; }

  setSubmitStatus('');
  renderCanvas();
  updateSendBar();

  const d = drawer();
  if (d) d.classList.add('is-open');
  const bd = document.getElementById('work-draft-backdrop');
  if (bd) bd.classList.add('is-visible');
  document.body.style.overflow = 'hidden';

  const sourceEl = document.getElementById('wdd-source');
  if (sourceEl) {
    sourceEl.classList.add('is-open');
    sourceEl.classList.remove('is-collapsed');
  }
  if (ta?.value) {
    scheduleServerDraft();
  } else if (ta) {
    ta.focus();
  }
  updateSourceToggleLabel();
}

export function closeWorkDraftDrawer(force = false) {
  // Guard: warn before discarding unsaved canvas items
  if (!force) {
    const hasPending = _items.some((item) => item.type !== 'I' && item.title.trim());
    if (hasPending) {
      const counts = countsByStatus();
      const label = counts.safe > 0
        ? `${counts.safe} issue${counts.safe === 1 ? '' : 's'} ready to create`
        : `${_items.filter((i) => i.type !== 'I').length} unsaved item${_items.filter((i) => i.type !== 'I').length === 1 ? '' : 's'}`;
      if (!window.confirm(`Close and discard ${label}?`)) return;
    }
  }
  const d = drawer();
  if (d) {
    d.classList.remove('is-open');
    d.querySelector('.wdd-settings-panel')?.remove();
  }
  const bd = document.getElementById('work-draft-backdrop');
  if (bd) bd.classList.remove('is-visible');
  document.body.style.overflow = '';
  _focusedItemId = null;
  _settingsOpen = false;
  clearTimeout(_parseTimer);
}

// ─── Project chip ─────────────────────────────────────────────────────────────

function updateProjectChip() {
  const label = document.getElementById('wdd-project-label');
  if (label) label.textContent = _projectKey || 'Project';
  renderProjectPopover();
}

function renderProjectPopover() {
  const pop = document.getElementById('wdd-project-popover');
  if (!pop) return;
  if (!_projectOptions.length) { pop.hidden = true; pop.innerHTML = ''; return; }
  pop.innerHTML = _projectOptions.map((p) =>
    `<button class="wdd-project-popover-item${p === _projectKey ? ' is-active' : ''}" data-project="${esc(p)}">${esc(p)}</button>`
  ).join('');
}

// ─── Trust strip ──────────────────────────────────────────────────────────────

function updateTrustStrip() {
  const strip = document.getElementById('wdd-trust-strip');
  if (!strip) return;
  const ctx = getDraftContext();
  const noBoardCtx = !Number.isFinite(ctx.boardId) || ctx.boardId <= 0;
  strip.innerHTML = noBoardCtx
    ? 'Draft only · No existing Jira issues will be changed · Undo available before send · <span class="wdd-trust-strip-warn">No backlog context loaded — duplicate detection limited</span>'
    : 'Draft only · No existing Jira issues will be changed · Undo available before send';
}

// ─── Jira key detection ───────────────────────────────────────────────────────

function detectJiraKeys(narrative) {
  const matches = String(narrative || '').match(JIRA_KEY_RE);
  _jiraKeysDetected = matches ? [...new Set(matches)] : [];
}

// ─── Server draft fetching ────────────────────────────────────────────────────

function scheduleServerDraft() {
  clearTimeout(_parseTimer);
  _parseTimer = setTimeout(fetchServerDraft, PARSE_DEBOUNCE_MS);
}

async function fetchServerDraft() {
  const ta = document.getElementById('wdd-source-textarea');
  const narrative = String(ta?.value || '').trim();
  detectJiraKeys(narrative);
  if (!narrative || !_projectKey) {
    renderQuickPreview(narrative);
    return;
  }
  showParseStatus('Analysing…', true);
  _isDraftLoading = true;
  const ctx = getDraftContext();
  const recentProjectKeys = readRecentActivityProjectKeys();
  try {
    const res = await postWithTimeout('/api/outcome-draft', {
      narrative,
      projectKey: _projectKey,
      selectedProjects: _projectOptions,
      boardId: Number.isFinite(ctx.boardId) ? ctx.boardId : null,
      inputMode: 'mixed',
      quarterHint: ctx.quarterHint,
      recentProjectKeys,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showParseStatus(json.message || json.error || 'Draft failed');
      renderQuickPreview(narrative);
      return;
    }
    applyServerDraft(json, narrative);
    collapseSource();
  } catch (err) {
    showParseStatus('Parse failed: ' + (err?.message || 'network'));
    renderQuickPreview(narrative);
  } finally {
    _isDraftLoading = false;
  }
}

function collapseSource() {
  const sourceEl = document.getElementById('wdd-source');
  if (sourceEl) {
    sourceEl.classList.add('is-collapsed', 'wdd-had-items');
    sourceEl.classList.remove('is-open');
  }
  updateSourceToggleLabel();
}

function expandSource() {
  const sourceEl = document.getElementById('wdd-source');
  if (sourceEl) { sourceEl.classList.add('is-open'); sourceEl.classList.remove('is-collapsed'); }
  const ta = document.getElementById('wdd-source-textarea');
  if (ta) ta.focus();
  updateSourceToggleLabel();
}

function updateSourceToggleLabel() {
  const btn = document.getElementById('wdd-source-toggle');
  const sourceEl = document.getElementById('wdd-source');
  if (!btn || !sourceEl) return;
  const isOpen = sourceEl.classList.contains('is-open');
  btn.textContent = isOpen ? '▲ Source' : '▼ Edit source';
  btn.setAttribute('aria-expanded', String(isOpen));
}

function readRecentActivityProjectKeys() {
  try {
    const raw = window.localStorage.getItem(OUTCOME_ACTIVITY_LOG_KEY);
    const parsed = JSON.parse(raw || '[]');
    const log = Array.isArray(parsed) ? parsed : [];
    const keys = new Set();
    log.slice(0, 5).forEach((entry) => { if (entry?.projectKey) keys.add(String(entry.projectKey).toUpperCase()); });
    return Array.from(keys);
  } catch (_) { return []; }
}

function showParseStatus(msg, spinner = false) {
  const el = document.getElementById('wdd-parse-status');
  if (!el) return;
  if (!msg) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = (spinner ? '<span class="wdd-parse-status-spinner"></span>' : '') + esc(msg);
}

function serverTypeToChip(serverType) {
  return SERVER_TYPE_TO_CHIP[String(serverType || '')] || null;
}

function inferTypeFromKind(kind) {
  if (!kind) return 'S';
  const k = String(kind).toUpperCase();
  if (k === 'EPIC') return 'E';
  if (k === 'SUBTASK' || k === 'TASK') return 'T';
  if (k === 'STORY' || k === 'ISSUE') return 'S';
  return 'S';
}

function warningsFromRow(row) {
  const list = [];
  const rw = Array.isArray(row.warnings) ? row.warnings : [];
  rw.forEach((w) => { const msg = String(w?.message || w?.code || w || '').trim(); if (msg) list.push(msg); });
  return list;
}

function applyServerDraft(payload, narrative) {
  pushUndo();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) {
    renderQuickPreview(narrative);
    return;
  }
  _items = [];
  _ignoredItems = [];
  rows.forEach((row, idx) => {
    const title = String(row.title || '').trim();
    if (!title) return;

    // Respect the type field from AI provider responses; fall back to isParent heuristic
    const fromServerType = serverTypeToChip(row.type);
    const isParent = row.isParent === true || (idx === 0 && rows.length > 1 && !row.childItemIndex);
    const chipType = fromServerType || (isParent ? 'E' : 'S');

    if (chipType === 'I') {
      _ignoredItems.push({ title, sourceLineIndex: idx });
      return;
    }

    const depth = Number(row.depth ?? (chipType === 'E' ? 0 : 1));
    const confidence = Number(row.confidence ?? 1);
    const warnings = warningsFromRow(row);
    if (confidence < 0.5 && !warnings.length) warnings.push('Low confidence — review intent before creating');
    _items.push({
      id: uid(),
      type: chipType,
      title,
      depth,
      confidence,
      warnings,
      duplicate: row.duplicate || null,
      suggestedAssignee: row.suggestedAssignee || null,
      sourceLineIndex: idx,
      selected: true,
    });
  });
  renderCanvas();
  updateSendBar();

  // Show precheck message from server (e.g. "Quarterly epic batch detected…")
  if (payload.precheck?.message) {
    showParseStatus(payload.precheck.message);
  } else if (_jiraKeysDetected.length) {
    showParseStatus(`Jira key${_jiraKeysDetected.length > 1 ? 's' : ''} detected (${_jiraKeysDetected.slice(0, 3).join(', ')}) — these will be linked, not created`);
  } else {
    showParseStatus('');
  }

  // Capacity fit hint: green positive signal when item count fits the team's sprint pattern
  const capacityEl = document.getElementById('wdd-capacity-hint');
  if (capacityEl) {
    if (payload.capacityFitHint) {
      capacityEl.textContent = payload.capacityFitHint;
      capacityEl.hidden = false;
    } else {
      capacityEl.hidden = true;
      capacityEl.textContent = '';
    }
  }
}

function renderQuickPreview(narrative) {
  if (!narrative) { _items = []; _ignoredItems = []; renderCanvas(); updateSendBar(); return; }
  const parsed = parseOutcomeIntake(narrative, {});
  if (!parsed || parsed.mode === 'empty') { _items = []; renderCanvas(); updateSendBar(); return; }
  // No pushUndo() here — automatic preview is not a user action
  _items = [];
  _ignoredItems = [];
  const confidence = parsed.confidenceScore ?? 0.5;
  (parsed.previewRows || []).forEach((row, idx) => {
    const title = String(row.title || '').trim();
    if (!title) return;
    const type = inferTypeFromKind(row.kind);
    const isParent = idx === 0 && (parsed.previewRows || []).length > 1;
    const depth = (isParent || type === 'E') ? 0 : 1;
    const warnings = confidence < 0.5 ? ['Low confidence — review intent before creating'] : [];
    _items.push({ id: uid(), type, title, depth, confidence, warnings, duplicate: null, sourceLineIndex: idx, selected: true });
  });
  if (_items.length > 0) collapseSource();
  renderCanvas();
  updateSendBar();
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

function renderCanvas() {
  const canvas = document.getElementById('wdd-canvas');
  if (!canvas) return;

  if (!_items.length) {
    canvas.innerHTML = '<div style="padding:20px 16px;color:var(--muted);font-size:0.85rem;line-height:1.5">Paste your goals, brain dump, or meeting notes above — AI will structure them into Jira work items based on your project\'s history. Or press <kbd>Enter</kbd> to add items manually.</div>';
    renderIgnoredFold(canvas);
    return;
  }

  const visible = _showingReviewOnly ? _items.filter((item) => item.warnings.length || item.duplicate) : _items;
  canvas.innerHTML = visible.map((item) => renderItem(item)).join('')
    + '<div class="wdc-item wdc-add-row" data-add-item style="opacity:0.5;cursor:pointer"><span style="font-size:0.8rem;color:var(--muted);padding:2px 8px">+ Add item  <kbd>Enter</kbd></span></div>';

  renderIgnoredFold(canvas);

  if (_focusedItemId) {
    const input = canvas.querySelector(`[data-item-id="${_focusedItemId}"] .wdc-title`);
    if (input instanceof HTMLInputElement) { input.focus(); const l = input.value.length; input.setSelectionRange(l, l); }
  }
}

function renderItem(item) {
  const repairHtml = buildRepairHtml(item);
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  return `<div class="wdc-item${item.type === 'I' ? ' is-ignored' : ''}${_focusedItemId === item.id ? ' is-focused' : ''}"
    data-item-id="${esc(item.id)}"
    style="--wdc-depth:${item.depth}"
    role="listitem">
  <button class="wdc-type-chip" data-type="${esc(item.type)}" title="Type: ${esc(typeLabel)} — click to change" aria-label="Item type: ${esc(typeLabel)}">${esc(item.type)}</button>
  <div class="wdc-item-body">
    <input type="text" class="wdc-title" value="${esc(item.title)}" placeholder="Add title…" aria-label="Work item title" spellcheck="true" />
    ${repairHtml ? `<div class="wdc-repairs">${repairHtml}</div>` : ''}
  </div>
  <button class="wdc-item-menu-btn" title="More options" aria-label="More options for this item">⋮</button>
</div>`;
}

function buildRepairHtml(item) {
  const parts = [];

  if (item.suggestedAssignee) {
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--assignee" title="Based on who worked on similar items in this board">Suggested: ${esc(item.suggestedAssignee)}</span>`
      + `<button class="wdc-repair-action" data-repair="accept-assignee" data-item-id="${esc(item.id)}" data-assignee="${esc(item.suggestedAssignee)}">Use</button>`);
  }

  if (item.duplicate?.key) {
    const dk = esc(item.duplicate.key);
    const dscore = item.duplicate.similarity != null ? ` ${Math.round(Number(item.duplicate.similarity) * 100)}% match` : '';
    parts.push(`<span class="wdc-repair-chip wdc-repair-chip--dupe">Similar: ${dk}${esc(dscore)}</span>`
      + `<button class="wdc-repair-action" data-repair="link-dup" data-item-id="${esc(item.id)}" data-dup-key="${dk}">Link</button>`
      + `<button class="wdc-repair-action" data-repair="create-new" data-item-id="${esc(item.id)}">Create new</button>`
      + `<button class="wdc-repair-action" data-repair="ignore-dup" data-item-id="${esc(item.id)}">Ignore</button>`);
  }

  item.warnings.forEach((w) => {
    const wl = String(w).toLowerCase();
    if (wl.includes('parent') || wl.includes('parent unclear')) {
      const suggested = _items.find((i) => i.depth === 0 && i.id !== item.id);
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

function renderIgnoredFold(canvas) {
  if (!_ignoredItems.length) return;
  const fold = document.createElement('div');
  fold.className = 'wdd-ignored-fold';
  const label = `${_ignoredItems.length} line${_ignoredItems.length === 1 ? '' : 's'} ignored as non-work`;
  fold.innerHTML = `<button class="wdd-ignored-fold-toggle" aria-expanded="false" data-action="toggle-ignored-fold">▸ ${esc(label)}</button>`
    + `<div class="wdd-ignored-fold-items" hidden>`
    + _ignoredItems.map((item, idx) =>
      `<div class="wdd-ignored-fold-item"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.title)}</span><button class="wdd-ignored-restore-btn" data-restore-idx="${idx}">Restore</button></div>`
    ).join('')
    + `</div>`;
  canvas.appendChild(fold);
}

// ─── Send bar ─────────────────────────────────────────────────────────────────

function countsByStatus() {
  let safe = 0, review = 0, ignored = 0;
  _items.forEach((item) => {
    if (item.type === 'I') { ignored++; return; }
    // Empty-titled items are not ready to create — treat as needing review
    if (!item.title.trim()) { review++; return; }
    if (item.warnings.length || item.duplicate) { review++; } else { safe++; }
  });
  return { safe, review, ignored: ignored + _ignoredItems.length };
}

function updateSendBar() {
  const counts = countsByStatus();
  const countsEl = document.getElementById('wdd-send-counts');
  const createBtn = document.getElementById('wdd-create-safe-btn');
  const reviewBtn = document.getElementById('wdd-review-btn');
  const hasJiraKeys = _jiraKeysDetected.length > 0;
  const noProject = !_projectKey;
  const totalItems = _items.length;

  if (countsEl) {
    if (totalItems === 0) {
      countsEl.innerHTML = '<span class="wdd-send-count wdd-send-count--empty">Paste notes above to get started</span>';
    } else {
      countsEl.innerHTML = ''
        + `<span class="wdd-send-count wdd-send-count--safe">Ready: ${counts.safe}</span>`
        + (counts.review ? `<button class="wdd-send-count wdd-send-count--review" data-action="toggle-review">Needs review: ${counts.review}</button>` : '')
        + (counts.ignored ? `<span class="wdd-send-count wdd-send-count--ignored">Ignored: ${counts.ignored}</span>` : '');
    }
  }

  if (createBtn) {
    if (noProject) {
      createBtn.disabled = true;
      createBtn.textContent = 'Select a project first';
    } else if (_isSubmitting) {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating…';
    } else if (hasJiraKeys) {
      createBtn.disabled = true;
      createBtn.textContent = 'Jira keys detected — link only';
    } else {
      createBtn.disabled = counts.safe === 0;
      createBtn.textContent = counts.safe === 0 ? 'Nothing to create yet' : `Create ${counts.safe} issue${counts.safe === 1 ? '' : 's'}`;
    }
  }

  if (reviewBtn) {
    reviewBtn.hidden = counts.review === 0;
    reviewBtn.textContent = `Review ${counts.review}`;
  }
}

function toggleReviewOnly() {
  _showingReviewOnly = !_showingReviewOnly;
  renderCanvas();
}

// ─── Structure inference ──────────────────────────────────────────────────────

function inferStructure(safeItems) {
  if (!safeItems.length) {
    return { structureMode: OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE, issueTypeName: 'Story', childIssueTypeName: null };
  }
  const parents = safeItems.filter((i) => i.depth === 0);
  const children = safeItems.filter((i) => i.depth > 0);

  if (safeItems.length === 1) {
    const single = safeItems[0];
    return { structureMode: OUTCOME_STRUCTURE_MODE.SINGLE_ISSUE, issueTypeName: single.type === 'E' ? 'Epic' : 'Story', childIssueTypeName: null };
  }

  if (parents.length && children.length) {
    const parentType = parents[0].type;
    const hasTaskChildren = children.some((c) => c.type === 'T');
    if (parentType === 'S' && hasTaskChildren) {
      return { structureMode: OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS, issueTypeName: 'Story', childIssueTypeName: 'Sub-task' };
    }
    return { structureMode: OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES, issueTypeName: 'Epic', childIssueTypeName: 'Story' };
  }

  if (!children.length) {
    if (parents.every((p) => p.type === 'E')) {
      return { structureMode: OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS, issueTypeName: 'Epic', childIssueTypeName: null };
    }
    return { structureMode: OUTCOME_STRUCTURE_MODE.TABLE_ISSUES, issueTypeName: 'Story', childIssueTypeName: null };
  }

  return { structureMode: OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES, issueTypeName: 'Epic', childIssueTypeName: 'Story' };
}

// ─── Keyboard handler ─────────────────────────────────────────────────────────

function onCanvasKeydown(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains('wdc-title')) return;
  const itemEl = input.closest('[data-item-id]');
  if (!itemEl) return;
  const id = itemEl.dataset.itemId;
  const idx = _items.findIndex((i) => i.id === id);
  if (idx === -1) return;

  if (e.key === 'Tab') {
    e.preventDefault();
    pushUndo();
    if (e.shiftKey) {
      _items[idx].depth = Math.max(0, _items[idx].depth - 1);
      // Only promote S→E on outdent to root; leave T/N/I unchanged
      if (_items[idx].depth === 0 && _items[idx].type === 'S') _items[idx].type = 'E';
    } else {
      _items[idx].depth = Math.min(3, _items[idx].depth + 1);
      // Only demote E→S on indent; leave T/N/I unchanged
      if (_items[idx].type === 'E' && _items[idx].depth > 0) _items[idx].type = 'S';
    }
    _focusedItemId = id;
    renderCanvas();
    updateSendBar();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    pushUndo();
    const currentDepth = _items[idx].depth;
    const newItem = { id: uid(), type: currentDepth === 0 ? 'E' : 'S', title: '', depth: currentDepth, confidence: 1, warnings: [], duplicate: null, sourceLineIndex: -1, selected: true };
    _items.splice(idx + 1, 0, newItem);
    _focusedItemId = newItem.id;
    renderCanvas();
    updateSendBar();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    createSafeIssues();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    applyUndo();
    return;
  }

  if (e.key === '/' && input.value === '') {
    e.preventDefault();
    openTypePicker(itemEl, id);
    return;
  }

  if (e.key === '?' && (e.ctrlKey || e.metaKey || input.value === '')) {
    e.preventDefault();
    showKbdHints();
    return;
  }
}

function onCanvasInput(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains('wdc-title')) return;
  const itemEl = input.closest('[data-item-id]');
  if (!itemEl) return;
  const id = itemEl.dataset.itemId;
  const item = _items.find((i) => i.id === id);
  if (!item) return;
  const val = input.value;
  item.title = val;
  const slashMatch = val.match(/^\/(\w+)\s*/);
  if (slashMatch) {
    const cmd = slashMatch[1].toLowerCase();
    const typeMap = { epic: 'E', story: 'S', task: 'T', note: 'N', ignore: 'I', parent: 'E' };
    if (typeMap[cmd]) {
      pushUndo();
      item.type = typeMap[cmd];
      item.title = val.slice(slashMatch[0].length);
      input.value = item.title;
      _focusedItemId = id;
      renderCanvas();
      updateSendBar();
      return;
    }
  }
  updateSendBar();
}

function onCanvasFocusin(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains('wdc-title')) return;
  const itemEl = input.closest('[data-item-id]');
  if (itemEl) {
    _focusedItemId = itemEl.dataset.itemId;
    itemEl.classList.add('is-focused');
  }
}

function onCanvasFocusout(e) {
  const itemEl = e.target instanceof HTMLElement ? e.target.closest('[data-item-id]') : null;
  if (itemEl) itemEl.classList.remove('is-focused');
}

// ─── Type chip cycling ────────────────────────────────────────────────────────

function onTypeChipClick(e) {
  const btn = e.target.closest('.wdc-type-chip');
  if (!btn) return;
  const itemEl = btn.closest('[data-item-id]');
  if (!itemEl) return;
  const id = itemEl.dataset.itemId;
  const item = _items.find((i) => i.id === id);
  if (!item) return;
  pushUndo();
  const cur = TYPE_CYCLE.indexOf(item.type);
  item.type = TYPE_CYCLE[(cur + 1) % TYPE_CYCLE.length];
  item.selected = item.type !== 'I';
  _focusedItemId = id;
  renderCanvas();
  updateSendBar();
}

// ─── Type picker (/ command) ──────────────────────────────────────────────────

function openTypePicker(itemEl, id) {
  document.querySelectorAll('.wdd-type-picker').forEach((el) => el.remove());
  const picker = document.createElement('div');
  picker.className = 'wdd-type-picker';
  picker.setAttribute('role', 'listbox');
  picker.setAttribute('aria-label', 'Choose type');
  const item = _items.find((i) => i.id === id);
  picker.innerHTML = TYPE_CYCLE.map((t) =>
    `<button class="wdd-type-picker-option${item?.type === t ? ' is-active' : ''}" data-type="${t}" data-pick-type="${id}" role="option" aria-selected="${item?.type === t}" title="${TYPE_LABELS[t]}">${t}</button>`
  ).join('');
  itemEl.style.position = 'relative';
  itemEl.appendChild(picker);
  picker.querySelector('.wdd-type-picker-option')?.focus();
  const dismiss = (ev) => {
    if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('mousedown', dismiss, true); }
  };
  document.addEventListener('mousedown', dismiss, true);
}

function onTypePickerClick(e) {
  const btn = e.target.closest('[data-pick-type]');
  if (!btn) return;
  const id = btn.dataset.pickType;
  const type = btn.dataset.type;
  const item = _items.find((i) => i.id === id);
  if (!item || !type) return;
  pushUndo();
  item.type = type;
  item.selected = type !== 'I';
  btn.closest('.wdd-type-picker')?.remove();
  _focusedItemId = id;
  renderCanvas();
  updateSendBar();
}

// ─── Repair chip actions ──────────────────────────────────────────────────────

function onRepairAction(e) {
  const btn = e.target.closest('[data-repair]');
  if (!btn) return;
  const action = btn.dataset.repair;
  const id = btn.dataset.itemId;
  const item = _items.find((i) => i.id === id);
  if (!item) return;
  pushUndo();

  switch (action) {
    case 'link-dup':
      item.duplicate = null;
      item.warnings = item.warnings.filter((w) => !w.toLowerCase().includes('duplicate') && !w.toLowerCase().includes('similar'));
      break;
    case 'create-new':
    case 'ignore-dup':
      item.duplicate = null;
      break;
    case 'group-under': {
      const targetId = btn.dataset.targetId;
      const target = _items.find((i) => i.id === targetId);
      if (target) { item.depth = target.depth + 1; item.type = 'S'; }
      item.warnings = item.warnings.filter((w) => !w.toLowerCase().includes('parent'));
      break;
    }
    case 'make-parent':
      item.depth = 0;
      item.type = 'E';
      item.warnings = item.warnings.filter((w) => !w.toLowerCase().includes('parent'));
      break;
    case 'ignore-item':
      item.type = 'I';
      item.selected = false;
      break;
    case 'mark-note':
      item.type = 'N';
      item.warnings = [];
      break;
    case 'keep-story':
      item.type = 'S';
      item.warnings = [];
      break;
    case 'accept-assignee': {
      const assignee = btn.dataset.assignee || '';
      // Accept the suggestion: store as confirmed assignee, clear the chip
      item.acceptedAssignee = assignee || item.suggestedAssignee;
      item.suggestedAssignee = null;
      break;
    }
  }

  _focusedItemId = id;
  renderCanvas();
  updateSendBar();
}

// ─── Ignored fold restore ─────────────────────────────────────────────────────

function onRestoreIgnored(e) {
  const btn = e.target.closest('[data-restore-idx]');
  if (!btn) return;
  const idx = Number(btn.dataset.restoreIdx);
  const restored = _ignoredItems.splice(idx, 1)[0];
  if (!restored) return;
  pushUndo();
  _items.push({ id: uid(), type: 'S', title: restored.title, depth: 1, confidence: 0.5, warnings: ['Restored from ignored — review type'], duplicate: null, sourceLineIndex: restored.sourceLineIndex, selected: true });
  renderCanvas();
  updateSendBar();
}

// ─── Add-item row ─────────────────────────────────────────────────────────────

function onAddItemClick(e) {
  if (!e.target.closest('[data-add-item]')) return;
  pushUndo();
  const newItem = { id: uid(), type: 'S', title: '', depth: 1, confidence: 1, warnings: [], duplicate: null, sourceLineIndex: -1, selected: true };
  _items.push(newItem);
  _focusedItemId = newItem.id;
  renderCanvas();
  updateSendBar();
}

// ─── Keyboard hints overlay ───────────────────────────────────────────────────

function showKbdHints() {
  const d = drawer();
  if (!d) return;
  document.querySelectorAll('.wdd-kbd-hints').forEach((el) => el.remove());
  const hints = document.createElement('div');
  hints.className = 'wdd-kbd-hints';
  hints.setAttribute('role', 'dialog');
  hints.setAttribute('aria-label', 'Keyboard shortcuts');
  const rows = [
    ['Enter', 'New item at same level'],
    ['Tab', 'Indent (nest under previous)'],
    ['Shift+Tab', 'Outdent (promote)'],
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Enter', 'Create safe issues'],
    ['/', 'Change type (at start of title)'],
    ['?', 'This help'],
  ];
  hints.innerHTML = `<h4>Keyboard shortcuts</h4>`
    + rows.map(([k, v]) => `<div class="wdd-kbd-hint-row"><span>${esc(v)}</span><kbd>${esc(k)}</kbd></div>`).join('')
    + `<div style="text-align:right;margin-top:10px"><button class="wdd-review-btn" style="font-size:0.78rem">Close</button></div>`;
  hints.querySelector('button')?.addEventListener('click', () => hints.remove());
  d.querySelector('.wdd-body')?.appendChild(hints);
  hints.querySelector('button')?.focus();
}

// ─── Flush active title input before computing safe list ──────────────────────

function flushActiveInput() {
  const focused = document.activeElement;
  if (focused instanceof HTMLInputElement && focused.classList.contains('wdc-title')) {
    const itemEl = focused.closest('[data-item-id]');
    if (itemEl) {
      const id = itemEl.dataset.itemId;
      const item = _items.find((i) => i.id === id);
      if (item) item.title = focused.value;
    }
  }
}

// ─── Issue creation ────────────────────────────────────────────────────────────

async function createSafeIssues(forceCreate = false) {
  flushActiveInput();
  const safeItems = _items.filter((item) => item.type !== 'I' && item.type !== 'N' && !item.warnings.length && !item.duplicate && item.title.trim());
  if (!safeItems.length || _isSubmitting) return;

  _isSubmitting = true;
  _conflictState = null;
  updateSendBar();
  setSubmitStatus('Creating…');

  const ta = document.getElementById('wdd-source-textarea');
  const narrative = String(ta?.value || safeItems.map((i) => i.title).join('\n')).trim();

  const { structureMode, issueTypeName, childIssueTypeName } = inferStructure(safeItems);

  const body = {
    narrative,
    projectKey: _projectKey || null,
    selectedProjects: _projectOptions,
    structureMode,
    confidenceScore: safeItems.reduce((sum, i) => sum + i.confidence, 0) / safeItems.length,
    issueTypeName: issueTypeName || null,
    childIssueTypeName: childIssueTypeName || null,
    // Only include source indices for server-parsed items; manually added items (index -1) are excluded
    commitChildIndices: safeItems.map((i) => i.sourceLineIndex).filter((n) => n >= 0),
    ...(forceCreate ? { createAnyway: true } : {}),
  };

  saveLastProject(_projectKey);

  try {
    const res = await postWithTimeout('/api/outcome-from-narrative', body);

    if (res.status === 409) {
      const conflict = await res.json().catch(() => ({}));
      _conflictState = { body, conflict };
      const msg = conflict.message || 'Possible duplicate detected.';
      setSubmitStatusWithAction(msg, 'Create anyway', () => {
        _conflictState = null;
        createSafeIssues(true);
      });
      return;
    }

    if (res.status === 422) {
      const errBody = await res.json().catch(() => ({}));
      const problems = Array.isArray(errBody.details?.problems) ? errBody.details.problems : [];
      const baseMsg = errBody.message || errBody.error || 'Configuration error — check Jira project settings';
      const formatProblem = (p) => {
        if (p?.message) return String(p.message);
        const role = String(p?.role || '').trim();
        const type = String(p?.issueTypeName || '').trim();
        const fields = Array.isArray(p?.missingFields) ? p.missingFields.join(', ') : '';
        return [role, type, fields ? `needs ${fields}` : ''].filter(Boolean).join(' ');
      };
      const detail = problems.length ? problems.map(formatProblem).filter(Boolean).join('; ') : '';
      setSubmitStatus(`Cannot create: ${baseMsg}${detail ? '. ' + detail : ''}`);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitStatus(err.message || err.error || 'Creation failed');
      return;
    }

    const json = await res.json().catch(() => ({}));
    persistActivity(json, _projectKey);
    renderFollowUp(json);

    safeItems.forEach((item) => {
      const i = _items.indexOf(item);
      if (i !== -1) _items.splice(i, 1);
    });

    renderCanvas();
    updateSendBar();

    if (Array.isArray(json.failures) && json.failures.length) {
      const names = json.failures.map((f) => String(f?.title || f?.summary || '')).filter(Boolean);
      setSubmitStatus(`Created ${json.createdCount ?? '?'} of ${json.expectedCreateCount ?? '?'}.${names.length ? ' Failed: ' + names.join(', ') : ''}`);
    } else {
      setSubmitStatus('');
    }
  } catch (err) {
    setSubmitStatus('Failed: ' + (err?.message || 'network'));
  } finally {
    _isSubmitting = false;
    updateSendBar();
  }
}

function setSubmitStatus(msg) {
  const el = document.getElementById('wdd-submit-status');
  if (el) el.textContent = msg || '';
}

function setSubmitStatusWithAction(msg, actionLabel, onAction) {
  const el = document.getElementById('wdd-submit-status');
  if (!el) return;
  el.innerHTML = `<span>${esc(msg)}</span> <button class="wdd-conflict-action-btn">${esc(actionLabel)}</button>`;
  el.querySelector('.wdd-conflict-action-btn')?.addEventListener('click', onAction);
}

function renderFollowUp(payload) {
  const el = document.getElementById('wdd-follow-up');
  if (!el) return;
  const created = extractCreatedIssues(payload);
  if (!created.length && !payload.verification && !payload.summaryHtml) { el.hidden = true; el.innerHTML = ''; return; }

  const links = created.map((item) => {
    const label = esc(item.key || 'Open issue');
    if (!item.url) return `<li>${label}</li>`;
    return `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${label}</a></li>`;
  }).join('');

  let verificationHtml = '';
  const v = payload.verification;
  if (v) {
    const createdCount = Number(payload.createdCount ?? created.length);
    const expectedCount = Number(payload.expectedCreateCount ?? createdCount);
    const checks = Array.isArray(v.issueChecks) ? v.issueChecks : [];
    const passCount = checks.filter((c) => c.issueType).length || createdCount;
    const totalChecks = Math.max(expectedCount, checks.length);
    const allPass = v.hierarchyVerified !== false && v.backlogTopVerified !== false && !Array.isArray(v.missingKeys?.length ? v.missingKeys : []).length;
    const hierarchyOk = v.hierarchyVerified !== false;
    const rankOk = v.backlogTopVerified !== false;
    const mismatches = Array.isArray(v.hierarchyMismatches) ? v.hierarchyMismatches : [];

    const overallOk = allPass;
    verificationHtml = `<div id="wdd-follow-up-verification" class="wdd-verification-panel">`
      + `<div class="wdd-verification-summary ${overallOk ? 'wdd-check-pass' : 'wdd-check-fail'}">${overallOk ? 'PASS' : 'FAIL'} — ${passCount}/${totalChecks} checks passed</div>`
      + checks.map((c) => `<div class="wdd-verification-check">${esc(c.key)}: <strong class="wdd-check-pass">PASS</strong></div>`).join('')
      + (!hierarchyOk ? `<div class="wdd-verification-check wdd-check-fail">FAIL — Hierarchy mismatches: ${esc(mismatches.map((m) => `${m.key} (expected ${m.expectedLevel}, got ${m.actualLevel})`).join(', '))}</div>` : '')
      + (!rankOk ? `<div class="wdd-verification-check wdd-check-warn">Not top-ranked yet in backlog. Run a refresh to confirm position.</div>` : '')
      + `</div>`;
  }

  el.hidden = false;
  el.innerHTML = (created.length ? `<p class="wdd-follow-up-title">Created ${created.length} issue${created.length === 1 ? '' : 's'}</p><ul class="wdd-follow-up-links">${links}</ul>` : '')
    + verificationHtml
    + (payload.summaryHtml && !created.length && !v ? `<div class="wdd-follow-up-summary">${payload.summaryHtml}</div>` : '');

  if (typeof _config.onCreated === 'function') _config.onCreated(payload, _projectKey);
}

// ─── AI provider settings ─────────────────────────────────────────────────────

function toggleSettings() {
  _settingsOpen = !_settingsOpen;
  renderSettingsPanel();
  document.getElementById('wdd-settings-btn')?.classList.toggle('is-active', _settingsOpen);
}

function renderSettingsPanel() {
  const d = drawer();
  if (!d) return;
  let panel = d.querySelector('.wdd-settings-panel');
  if (_settingsOpen && !panel) {
    panel = document.createElement('div');
    panel.className = 'wdd-settings-panel';
    d.querySelector('#wdd-safe-send-bar')?.insertAdjacentElement('beforebegin', panel);
  } else if (!_settingsOpen && panel) {
    panel.remove();
    return;
  }
  if (!panel) return;

  const ai = readAiProvider();
  const providers = [
    { id: 'built-in', label: 'Built-in', hint: 'No API key required', hasKey: false, hasHost: false },
    { id: 'claude', label: 'Claude (Anthropic)', hint: 'Key stored in browser session only', hasKey: true, hasHost: false },
    { id: 'openai', label: 'OpenAI', hint: 'Key stored in browser session only', hasKey: true, hasHost: false },
    { id: 'gemini', label: 'Google Gemini', hint: 'Key stored in browser session only', hasKey: true, hasHost: false },
    { id: 'ollama', label: 'Ollama (local)', hint: 'Runs locally — no API key needed', hasKey: false, hasHost: true },
  ];

  panel.innerHTML = `<div class="wdd-settings-title">AI Processing <button class="wdd-settings-close" aria-label="Close settings">✕</button></div>`
    + providers.map((p) => {
      const checked = (ai.provider || 'built-in') === p.id;
      const keyVal = checked && ai.key ? ai.key.replace(/./g, '●') : '';
      const hostVal = checked && ai.host ? ai.host : 'http://localhost:11434';
      return `<div class="wdd-ai-provider-row">
        <label class="wdd-ai-provider-label">
          <input type="radio" name="wdd-ai-provider" value="${esc(p.id)}"${checked ? ' checked' : ''}> ${esc(p.label)}
        </label>
        ${p.hasKey && checked ? `<input class="wdd-ai-key-input" type="password" placeholder="sk-…" value="${esc(keyVal)}" data-ai-key-for="${esc(p.id)}" autocomplete="off">
          <button class="wdd-ai-test-btn" data-ai-test="${esc(p.id)}">Test</button>
          <button class="wdd-ai-clear-btn" data-ai-clear="${esc(p.id)}">Clear</button>` : ''}
        ${p.hasHost && checked ? `<input class="wdd-ai-key-input" type="text" placeholder="http://localhost:11434" value="${esc(hostVal)}" data-ai-host-for="${esc(p.id)}">` : ''}
        <span class="wdd-ai-provider-hint">${esc(p.hint)}</span>
      </div>`;
    }).join('');
}

// Handles radio change and key/host input change — NOT click (avoids double-fire on radio buttons)
function onSettingsChange(e) {
  const radio = e.target.closest('input[name="wdd-ai-provider"]');
  if (radio instanceof HTMLInputElement) {
    const current = readAiProvider();
    saveAiProvider({ ...current, provider: radio.value, key: radio.value === current.provider ? (current.key || '') : '' });
    renderSettingsPanel();
    return;
  }
  const keyInput = e.target.closest('[data-ai-key-for]');
  if (keyInput instanceof HTMLInputElement) {
    const current = readAiProvider();
    saveAiProvider({ ...current, key: keyInput.value });
    return;
  }
  const hostInput = e.target.closest('[data-ai-host-for]');
  if (hostInput instanceof HTMLInputElement) {
    const current = readAiProvider();
    saveAiProvider({ ...current, host: hostInput.value });
    return;
  }
}

async function onAiTestClick(e) {
  const btn = e.target.closest('[data-ai-test]');
  if (!btn) return;
  const provider = btn.dataset.aiTest;
  const ai = readAiProvider();
  const hintEl = btn.closest('.wdd-ai-provider-row, label')?.querySelector('.wdd-ai-provider-hint')
    ?? btn.parentElement?.querySelector('.wdd-ai-provider-hint');
  const originalHint = hintEl?.textContent || '';
  btn.textContent = 'Testing…';
  btn.disabled = true;
  const reset = () => {
    btn.textContent = 'Test';
    btn.disabled = false;
    btn.dataset.testResult = '';
    if (hintEl) hintEl.textContent = originalHint;
  };
  try {
    const res = await fetch('/api/settings/ai-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-provider': provider, ...(ai.key ? { 'x-ai-key': ai.key } : {}) },
      body: JSON.stringify({ provider, action: 'test' }),
    });
    const json = await res.json().catch(() => ({}));
    const valid = Boolean(json.valid);
    btn.textContent = valid ? '✓ OK' : '✗ Failed';
    btn.dataset.testResult = valid ? 'pass' : 'fail';
    if (hintEl) hintEl.textContent = valid ? '✓ Connected' : `✗ Failed${json.error ? ': ' + json.error : ''}`;
    setTimeout(reset, 5000);
  } catch (_) {
    btn.textContent = '✗ Error';
    btn.dataset.testResult = 'error';
    if (hintEl) hintEl.textContent = '✗ Network error — check your connection';
    setTimeout(reset, 5000);
  }
}

function onAiClearClick(e) {
  const btn = e.target.closest('[data-ai-clear]');
  if (!btn) return;
  const current = readAiProvider();
  saveAiProvider({ ...current, key: '' });
  renderSettingsPanel();
}

// ─── Project popover ──────────────────────────────────────────────────────────

function onProjectChipClick(e) {
  const chip = e.target.closest('#wdd-project-chip');
  if (!chip) return;
  const pop = document.getElementById('wdd-project-popover');
  if (!pop) return;
  const open = !pop.hidden;
  pop.hidden = open;
  chip.setAttribute('aria-expanded', String(!open));
  if (!open) pop.querySelector('button')?.focus();
}

function onProjectSelect(e) {
  const btn = e.target.closest('[data-project]');
  if (!btn || !btn.closest('#wdd-project-popover')) return;
  _projectKey = btn.dataset.project;
  saveLastProject(_projectKey);
  const pop = document.getElementById('wdd-project-popover');
  if (pop) pop.hidden = true;
  document.getElementById('wdd-project-chip')?.setAttribute('aria-expanded', 'false');
  updateProjectChip();
  scheduleServerDraft();
}

// ─── Source textarea ──────────────────────────────────────────────────────────

function onSourceInput() {
  const ta = document.getElementById('wdd-source-textarea');
  const narrative = String(ta?.value || '').trim();
  detectJiraKeys(narrative);
  if (!narrative) { _items = []; _ignoredItems = []; renderCanvas(); updateSendBar(); return; }
  renderQuickPreview(narrative);
  scheduleServerDraft();
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  const d = drawer();
  if (!d) return;

  document.getElementById('wdd-close-btn')?.addEventListener('click', closeWorkDraftDrawer);
  document.getElementById('work-draft-backdrop')?.addEventListener('click', closeWorkDraftDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && d.classList.contains('is-open')) {
      if (_settingsOpen) { toggleSettings(); } else { closeWorkDraftDrawer(); }
    }
  });

  const ta = document.getElementById('wdd-source-textarea');
  ta?.addEventListener('input', onSourceInput);
  // Strip HTML on paste (e.g. from Notion, email, Slack) and enforce char limit
  ta?.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      e.preventDefault();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      let plain = (tmp.textContent || tmp.innerText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (!plain.trim()) {
        showParseStatus('Pasted content appears to be formatting only — no plain text found.');
        return;
      }
      if (plain.length > MAX_NARRATIVE_CHARS) {
        plain = plain.slice(0, MAX_NARRATIVE_CHARS);
        showParseStatus(`Pasted text trimmed to ${MAX_NARRATIVE_CHARS.toLocaleString()} characters.`);
      }
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, start) + plain + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + plain.length;
    }
    requestAnimationFrame(() => {
      if (ta.value.length > MAX_NARRATIVE_CHARS) {
        ta.value = ta.value.slice(0, MAX_NARRATIVE_CHARS);
        showParseStatus(`Input trimmed to ${MAX_NARRATIVE_CHARS.toLocaleString()} characters.`);
      }
      onSourceInput();
    });
  });
  document.getElementById('wdd-settings-btn')?.addEventListener('click', toggleSettings);
  document.getElementById('wdd-source-toggle')?.addEventListener('click', () => {
    const sourceEl = document.getElementById('wdd-source');
    if (!sourceEl) return;
    if (sourceEl.classList.contains('is-collapsed')) { expandSource(); } else { collapseSource(); }
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target?.closest('[data-open-outcome-modal]');
    if (!trigger) return;
    e.preventDefault();
    openWorkDraftDrawer({
      narrative: trigger.getAttribute('data-outcome-prefill') || '',
      preferredProject: trigger.getAttribute('data-outcome-project') || '',
      contextLabel: trigger.getAttribute('data-outcome-context') || '',
      contextProjects: (trigger.getAttribute('data-outcome-projects') || '').split(',').map((v) => v.trim()).filter(Boolean),
    });
  });

  window.addEventListener('app:openOutcomeModal', (e) => {
    openWorkDraftDrawer(e?.detail || {});
  });

  const canvas = document.getElementById('wdd-canvas');
  if (canvas) {
    canvas.addEventListener('keydown', onCanvasKeydown);
    canvas.addEventListener('input', onCanvasInput);
    canvas.addEventListener('focusin', onCanvasFocusin);
    canvas.addEventListener('focusout', onCanvasFocusout);
    canvas.addEventListener('click', (e) => {
      onTypeChipClick(e);
      onRepairAction(e);
      onAddItemClick(e);
      onTypePickerClick(e);
      onRestoreIgnored(e);
    });
  }

  document.getElementById('wdd-create-safe-btn')?.addEventListener('click', () => createSafeIssues());
  document.getElementById('wdd-review-btn')?.addEventListener('click', toggleReviewOnly);


  // Delegated handlers on the drawer element — covers dynamically injected elements
  d.addEventListener('click', (e) => {
    onProjectChipClick(e);
    onProjectSelect(e);
    // NOTE: onSettingsChange is NOT here — it's on the 'change' event to avoid double-fire on radio clicks
    onAiTestClick(e);
    onAiClearClick(e);

    // Toggle review from the send-counts chip (element is recreated on each updateSendBar call)
    if (e.target?.closest('[data-action="toggle-review"]')) toggleReviewOnly();

    // Toggle ignored-notes fold expand/collapse
    const ignoredToggle = e.target?.closest('[data-action="toggle-ignored-fold"]');
    if (ignoredToggle) {
      const foldEl = ignoredToggle.closest('.wdd-ignored-fold');
      const itemsEl = foldEl?.querySelector('.wdd-ignored-fold-items');
      if (itemsEl) {
        const nowOpen = itemsEl.hidden;
        itemsEl.hidden = !nowOpen;
        ignoredToggle.setAttribute('aria-expanded', String(nowOpen));
        ignoredToggle.textContent = (nowOpen ? '▾ ' : '▸ ') + ignoredToggle.textContent.slice(2);
      }
    }

    // Close settings panel via its X button
    if (e.target?.closest('.wdd-settings-close')) toggleSettings();

    // Close project popover when clicking outside it
    const pop = document.getElementById('wdd-project-popover');
    if (pop && !pop.hidden && !e.target?.closest('#wdd-project-chip') && !e.target?.closest('#wdd-project-popover')) {
      pop.hidden = true;
      document.getElementById('wdd-project-chip')?.setAttribute('aria-expanded', 'false');
    }
  });

  // Settings inputs fire on 'change', not 'click', so radio buttons don't double-fire
  d.addEventListener('change', onSettingsChange);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initWorkDraftDrawer(config = {}) {
  _config = config || {};
  ensureDrawer();
  wireEvents();
}

// Legacy aliases preserved for existing call sites
export { initWorkDraftDrawer as initGlobalOutcomeModal, openWorkDraftDrawer as openGlobalOutcomeModal };
