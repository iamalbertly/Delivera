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

// Map server/AI-returned type strings to canvas chip letters.
// Accepts full names ('Task'), uppercase variants ('TASK'), already-resolved chip letters ('T'),
// and falls back to inferring from kind ('EPIC'→'E', 'TASK'→'T', 'STORY'/'ISSUE'→'S').
const _TYPE_STRING_TO_CHIP = {
  Epic: 'E', Story: 'S', Task: 'T', 'Sub-task': 'T', Note: 'N', Ignore: 'I',
  EPIC: 'E', STORY: 'S', TASK: 'T', NOTE: 'N', IGNORE: 'I',
  E: 'E', S: 'S', T: 'T', N: 'N', I: 'I',
};

function chipLetterFromServer(type, kind) {
  const fromType = _TYPE_STRING_TO_CHIP[String(type || '')];
  if (fromType) return fromType;
  const k = String(kind || '').toUpperCase();
  if (k === 'EPIC') return 'E';
  if (k === 'SUBTASK' || k === 'TASK') return 'T';
  if (k === 'STORY' || k === 'ISSUE') return 'S';
  return null;
}

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
  // Layer 1: page-context projects + prefill
  const fromContext = [...selected, ...(prefill.contextProjects || [])];
  // Layer 2: global project context CSV (PROJECTS_SSOT_KEY — user's configured project list)
  const fromCsv = readProjectContextCsv().split(',').map((v) => v.trim()).filter(Boolean);
  // Layer 3: recent activity log (last 3 projects used successfully)
  const fromActivity = readRecentActivityProjectKeys().slice(0, 3);
  return Array.from(new Set([...fromContext, ...fromCsv, ...fromActivity].map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)));
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
  <span class="wdd-title" id="wdd-title">Create work</span>
  <button class="wdd-settings-btn" id="wdd-settings-btn" aria-label="AI provider settings" title="AI provider settings">⚙</button>
  <button class="wdd-close-btn" id="wdd-close-btn" aria-label="Close">✕</button>
</div>
<div class="wdd-trust-strip" id="wdd-trust-strip"></div>
<div class="wdd-body" id="wdd-body">
  <div class="wdd-source is-open" id="wdd-source">
    <button class="wdd-source-toggle" id="wdd-source-toggle" aria-label="Toggle source text">▲ Source</button>
    <textarea class="wdd-source-textarea" id="wdd-source-textarea" rows="5"
      placeholder="Paste goals or notes — AI structures them into Jira tasks based on project history…"
      aria-label="Narrative source text"
      spellcheck="true"></textarea>
  </div>
  <div class="wdd-parse-status" id="wdd-parse-status" hidden></div>
  <div class="wdd-capacity-hint" id="wdd-capacity-hint" hidden aria-live="polite"></div>
  <div class="wdd-canvas" id="wdd-canvas" role="list" aria-label="Work items" tabindex="0"></div>
  <div class="wdd-follow-up" id="wdd-follow-up" hidden></div>
</div>
<div class="wdd-safe-send-bar" id="wdd-safe-send-bar">
  <div class="wdd-send-counts" id="wdd-send-counts"></div>
  <div class="wdd-bulk-estimate-row" id="wdd-bulk-estimate-row" hidden aria-label="Set estimate for all items">
    <label class="wdd-bulk-estimate-label" for="wdd-bulk-slider">All:</label>
    <input type="range" class="wdd-bulk-slider" id="wdd-bulk-slider" min="0" max="7" step="1" value="0" aria-label="Set estimate for all items" />
    <span class="wdd-bulk-slider-label" id="wdd-bulk-slider-label">—</span>
  </div>
  <div class="wdd-send-actions" id="wdd-send-actions">
    <button class="wdd-create-safe-btn" id="wdd-create-safe-btn" disabled>Create 0 issues</button>
    <button class="wdd-review-btn" id="wdd-review-btn" hidden>Review warnings</button>
    <button class="wdd-skip-all-done-btn" id="wdd-skip-all-done-btn" hidden aria-live="polite">Skip all done</button>
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
  document.body.classList.add('wdd-panel-open');
  document.body.style.overflow = 'hidden';

  const sourceEl = document.getElementById('wdd-source');
  if (sourceEl) {
    sourceEl.classList.add('is-open');
    sourceEl.classList.remove('is-collapsed');
  }

  // If no project resolved from any context, auto-open the project popover so the user
  // can pick or type one — don't leave them staring at a permanently-disabled Create button.
  if (!_projectKey) {
    const pop = document.getElementById('wdd-project-popover');
    if (pop) {
      pop.hidden = false;
      document.getElementById('wdd-project-chip')?.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.getElementById('wdd-project-manual-input')?.focus(), 80);
    }
  } else if (ta?.value) {
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
  document.body.classList.remove('wdd-panel-open');
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
  const items = _projectOptions.map((p) =>
    `<button class="wdd-project-popover-item${p === _projectKey ? ' is-active' : ''}" data-project="${esc(p)}">${esc(p)}</button>`
  ).join('');
  // Always include free-text fallback so users can type any project key without needing board context
  pop.innerHTML = items
    + `<div class="wdd-project-popover-manual">
        <input type="text" class="wdd-project-manual-input" id="wdd-project-manual-input"
          placeholder="Type project key (e.g. OPS)"
          maxlength="12" autocomplete="off" spellcheck="false"
          aria-label="Enter project key manually" />
       </div>`
    + (!items ? `<p class="wdd-project-popover-hint">No projects found in current context — enter a key above to get started.</p>` : '');
}

// ─── Trust strip ──────────────────────────────────────────────────────────────

function updateTrustStrip() {
  const strip = document.getElementById('wdd-trust-strip');
  if (!strip) return;
  const ctx = getDraftContext();
  const noBoardCtx = !Number.isFinite(ctx.boardId) || ctx.boardId <= 0;
  if (noBoardCtx) {
    strip.classList.add('has-warn');
    strip.innerHTML = '<span class="wdd-trust-strip-warn">⚠ No backlog context loaded — duplicate detection limited</span>';
  } else {
    strip.classList.remove('has-warn');
    strip.innerHTML = '';
  }
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

function precheckIcon(msg) {
  const m = String(msg).toLowerCase();
  if (m.startsWith('numbered task') || m.includes('quarterly epic') || m.includes('flat sprint')) return '✓';
  if (m.includes('warn') || m.includes('support') || m.includes('maintenance') || m.includes('mixed')) return '⚠';
  return 'ℹ';
}

function showParseStatus(msg, spinner = false) {
  const el = document.getElementById('wdd-parse-status');
  if (!el) return;
  if (!msg) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const icon = spinner ? '<span class="wdd-parse-status-spinner"></span>' : `<span style="flex-shrink:0">${precheckIcon(msg)}</span>`;
  el.innerHTML = icon + `<span>${esc(msg)}</span>`;
}

// A duplicate object with suggestedAction:'createNew' or 'reviewSimilar' doesn't block creation.
// 'skipAlreadyDone', 'mergeIntoExistingStory', 'attachToExistingEpic' are blocking.
function hasMeaningfulDuplicate(item) {
  const action = item.duplicate?.suggestedAction;
  return action != null && action !== 'createNew' && action !== 'reviewSimilar';
}

function isDoneDuplicate(item) {
  return item.duplicate?.suggestedAction === 'skipAlreadyDone' || item.duplicate?.isDoneMatch === true;
}

function skipAllDoneDuplicates() {
  pushUndo();
  _items.forEach((item) => {
    if (isDoneDuplicate(item) && item.type !== 'I') {
      item.type = 'I';
      item.selected = false;
    }
  });
  // Edge case: if in review-only mode, skipping all done items could leave an empty canvas view
  _showingReviewOnly = false;
  renderCanvas();
  updateSendBar();
}

function warningsFromRow(row) {
  const list = [];
  const rw = Array.isArray(row.warnings) ? row.warnings : [];
  rw.forEach((w) => { const msg = String(w?.message || w?.code || w || '').trim(); if (msg) list.push(msg); });
  return list;
}

function applyServerDraft(payload, narrative) {
  _showingReviewOnly = false;
  pushUndo();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) {
    renderQuickPreview(narrative);
    return;
  }
  _items = [];
  _ignoredItems = [];

  // Pre-scan: detect if any row is an Epic-level item; flat task clusters have no epics.
  const batchHasEpic = rows.some((r) => chipLetterFromServer(r.type, r.kind) === 'E');

  rows.forEach((row, idx) => {
    const title = String(row.title || '').trim();
    if (!title) return;

    // Respect the type field from AI provider responses; fall back to isParent heuristic
    const fromServerType = chipLetterFromServer(row.type, row.kind);
    const isParent = row.isParent === true || (idx === 0 && rows.length > 1 && !row.childItemIndex);
    const chipType = fromServerType || (isParent ? 'E' : 'S');

    if (chipType === 'I') {
      _ignoredItems.push({ title, sourceLineIndex: idx });
      return;
    }

    // Flat task clusters (SEQUENTIAL_TASK_CLUSTER) have no parent epic: all items sit at depth 0.
    const depth = Number(row.depth ?? (chipType === 'E' ? 0 : (batchHasEpic ? 1 : 0)));
    const confidence = Number(row.confidence ?? 1);
    const warnings = warningsFromRow(row);
    if (confidence < 0.5 && !warnings.length) warnings.push('Low confidence — review intent before creating');
    const sp = row.suggestedStoryPoints ?? null;
    // Bridge: SP → estimate slider position (story points take priority over keyword auto-suggest)
    const spStep = sp != null ? (ESTIMATE_SCALE.spToStep[sp] ?? 0) : 0;
    const keywordHours = spStep === 0 ? autoSuggestEstimate(title) : null;
    _items.push({
      id: uid(),
      type: chipType,
      title,
      depth,
      confidence,
      warnings,
      duplicate: row.duplicate || null,
      suggestedAssignee: row.suggestedAssignee || null,
      estimateHours: spStep > 0 ? stepToHours(spStep) : keywordHours,
      suggestedStoryPoints: sp,
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
    const type = chipLetterFromServer(null, row.kind) || 'S';
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
  const savedScroll = canvas.scrollTop;

  const titleEl = document.getElementById('wdd-title');
  if (titleEl) {
    if (_items.length > 0) {
      const totalSP = _items.reduce((s, i) => s + (i.type !== 'I' && i.type !== 'N' ? (i.suggestedStoryPoints || 0) : 0), 0);
      titleEl.textContent = totalSP > 0 ? `Create work · ${_items.length} · ${totalSP}pt` : `Create work · ${_items.length}`;
    } else {
      titleEl.textContent = 'Create work';
    }
  }

  if (!_items.length) {
    const exampleText = '0: Clean Site Data.\n1: Reload from MIS.\n2: Validate alignment.';
    const hint = _projectKey
      ? `<div class="wdc-empty-hint">Paste your task list or press <kbd>Enter</kbd> to add the first item. <button class="wdc-example-btn" data-action="paste-example">Try example</button></div>`
      : `<div class="wdc-empty-hint wdc-empty-hint--no-project"><span>Set a project above</span> then paste your task list — e.g.<br><code>${exampleText}</code><br><button class="wdc-example-btn" data-action="paste-example">Use this example</button></div>`;
    canvas.innerHTML = hint;
    renderIgnoredFold(canvas);
    return;
  }

  const workItems = _items.filter((i) => i.type !== 'I' && i.type !== 'N');
  const allDone = workItems.length > 0 && workItems.every((i) => isDoneDuplicate(i));
  const allDoneBanner = allDone
    ? `<div class="wdc-all-done-banner">All items appear to already exist in your Done column. Review matches or click "Create anyway" per item to override.</div>`
    : '';

  const visible = _showingReviewOnly ? _items.filter((item) => item.warnings.length || hasMeaningfulDuplicate(item)) : _items;
  canvas.innerHTML = allDoneBanner
    + visible.map((item) => renderItem(item)).join('')
    + '<div class="wdc-item wdc-add-row" data-add-item style="opacity:0.5;cursor:pointer"><span style="font-size:0.8rem;color:var(--muted);padding:2px 8px">+ Add item  <kbd>Enter</kbd></span></div>';

  renderIgnoredFold(canvas);

  if (savedScroll > 0) canvas.scrollTop = savedScroll;

  if (_focusedItemId) {
    const input = canvas.querySelector(`[data-item-id="${_focusedItemId}"] .wdc-title`);
    if (input instanceof HTMLInputElement) { input.focus(); const l = input.value.length; input.setSelectionRange(l, l); }
  }
}

function confidenceBand(confidence) {
  const c = Number(confidence ?? 1);
  if (c >= 0.7) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

// ESTIMATE_SCALE: discrete steps for the estimate slider (step 0 = no estimate)
const ESTIMATE_SCALE = {
  hours: [null, 0.5, 1, 2, 4, 8, 16, 32],
  labels: ['—', '½h', '1h', '2h', '4h', '8h', '1d', '2d'],
  max: 7,
  // Fibonacci-style SP → nearest matching step (1sp≈1h, 2sp≈2h, 3sp≈2h, 5sp≈4h, 8sp≈8h, 13sp≈1d, 21sp≈2d)
  spToStep: { 1: 2, 2: 3, 3: 3, 5: 4, 8: 5, 13: 6, 21: 7 },
};
function hoursToStep(hours) {
  if (hours == null) return 0;
  const idx = ESTIMATE_SCALE.hours.indexOf(hours);
  return idx >= 0 ? idx : 0;
}
function stepToLabel(step) { return ESTIMATE_SCALE.labels[step] || '—'; }
function stepToHours(step) { return ESTIMATE_SCALE.hours[step] ?? null; }

function autoSuggestEstimate(title) {
  const t = String(title || '').toLowerCase();
  if (/\b(validate|verify|check|test)\b/.test(t)) return 2;
  if (/\b(implement|build|create|develop|write)\b/.test(t)) return 4;
  if (/\b(deploy|configure|setup|install)\b/.test(t)) return 1;
  if (/\b(migrate|refactor|redesign|rewrite)\b/.test(t)) return 8;
  if (/\b(fix|patch|hotfix|repair)\b/.test(t)) return 2;
  if (/\b(reload|re-load|sync|load|re-validate)\b/.test(t)) return 1;
  return null;
}

function renderEstimateSlider(item) {
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

function renderItem(item) {
  const repairHtml = buildRepairHtml(item);
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const nextType = TYPE_CYCLE[(TYPE_CYCLE.indexOf(item.type) + 1) % TYPE_CYCLE.length];
  const nextLabel = TYPE_LABELS[nextType] || nextType;
  return `<div class="wdc-item${item.type === 'I' ? ' is-ignored' : ''}${_focusedItemId === item.id ? ' is-focused' : ''}"
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

function buildRepairHtml(item) {
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
    // Find Jira URL from warning with code 'ALREADY_DONE'
    const doneWarn = item.warnings.find ? null : null; // warnings are strings in canvas; url lives on duplicate obj itself
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
  let safe = 0, review = 0, ignored = 0, alreadyDone = 0;
  _items.forEach((item) => {
    if (item.type === 'I') { ignored++; return; }
    if (!item.title.trim()) { review++; return; }
    if (isDoneDuplicate(item)) { alreadyDone++; review++; }
    else if (item.warnings.length || hasMeaningfulDuplicate(item)) { review++; }
    else { safe++; }
  });
  return { safe, review, ignored: ignored + _ignoredItems.length, alreadyDone };
}

function dominantType() {
  if (!_items.length) return null;
  const tally = {};
  _items.forEach((i) => { if (i.type !== 'I') tally[i.type] = (tally[i.type] || 0) + 1; });
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function typeLabel(chip, count) {
  const singular = { E: 'Epic', S: 'Story', T: 'Task', N: 'Note' };
  const plural = { E: 'Epics', S: 'Stories', T: 'Tasks', N: 'Notes' };
  const map = count === 1 ? singular : plural;
  return map[chip] || (count === 1 ? 'item' : 'items');
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
        + (counts.alreadyDone ? (() => {
            const doneKeys = _items.filter((i) => isDoneDuplicate(i) && i.duplicate?.key).map((i) => i.duplicate.key).join(', ');
            const titleAttr = doneKeys ? ` title="${esc(doneKeys)}"` : '';
            return `<button class="wdd-send-count wdd-send-count--done-block" data-action="scroll-to-first-warning"${titleAttr}>Already done: ${counts.alreadyDone}</button>`;
          })() : '')
        + (counts.review - counts.alreadyDone > 0 ? `<button class="wdd-send-count wdd-send-count--review" data-action="scroll-to-first-warning">Review: ${counts.review - counts.alreadyDone}</button>` : '')
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
      const dom = dominantType();
      createBtn.disabled = counts.safe === 0;
      if (counts.safe === 0) {
        createBtn.textContent = counts.alreadyDone > 0
          ? `${counts.alreadyDone} item${counts.alreadyDone > 1 ? 's' : ''} already in Done — review or skip`
          : 'Nothing to create yet';
      } else {
        const safeList = _items.filter((i) => i.type !== 'I' && i.type !== 'N' && !i.warnings.length && !hasMeaningfulDuplicate(i) && i.title.trim());
        const totalHours = safeList.reduce((s, i) => s + (i.estimateHours || 0), 0);
        const totalSP = safeList.reduce((s, i) => s + (i.suggestedStoryPoints || 0), 0);
        const hoursSuffix = totalHours > 0 ? ` · ${totalHours}h` : '';
        const spSuffix = totalSP > 0 ? ` · ${totalSP}pt` : '';
        createBtn.textContent = `Create ${counts.safe} ${typeLabel(dom, counts.safe)}${spSuffix}${hoursSuffix}`;
      }
    }
  }

  if (reviewBtn) {
    reviewBtn.hidden = counts.review === 0;
    reviewBtn.textContent = `Review ${counts.review}`;
  }

  // Bulk estimate row: show when ≥2 safe items and none have estimates yet
  const bulkEl = document.getElementById('wdd-bulk-estimate-row');
  if (bulkEl) {
    const safeItems = _items.filter((i) => i.type !== 'I' && i.type !== 'N' && !i.warnings.length && !hasMeaningfulDuplicate(i) && i.title.trim());
    const anyEstimated = safeItems.some((i) => i.estimateHours != null);
    bulkEl.hidden = safeItems.length < 2 || anyEstimated;
  }

  // Skip-all-done button: show when any done-dup items exist
  const skipAllEl = document.getElementById('wdd-skip-all-done-btn');
  if (skipAllEl) {
    skipAllEl.hidden = counts.alreadyDone === 0;
    skipAllEl.textContent = `Skip all done (${counts.alreadyDone})`;
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
    const newItem = { id: uid(), type: currentDepth === 0 ? 'E' : 'S', title: '', depth: currentDepth, confidence: 1, warnings: [], duplicate: null, estimateHours: null, sourceLineIndex: -1, selected: true };
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

function onSpBadgeBlur(e) {
  const badge = e.target;
  if (!badge || !badge.classList.contains('wdc-sp-badge')) return;
  const itemEl = badge.closest('[data-item-id]');
  if (!itemEl) return;
  const id = itemEl.dataset.itemId;
  const item = _items.find((i) => i.id === id);
  if (!item) return;
  // Read text content, strip the "pt" unit span text
  const raw = badge.innerText.replace(/pt\s*$/i, '').trim();
  const parsed = parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 200) {
    item.suggestedStoryPoints = parsed || null;
  }
  // Re-render to normalize display (including the unit suffix)
  renderCanvas();
  updateSendBar();
}

function onEstimateSliderInput(e) {
  const slider = e.target;
  if (!(slider instanceof HTMLInputElement) || !slider.classList.contains('wdc-estimate-slider')) return;
  const id = slider.dataset.estimateFor;
  const item = _items.find((i) => i.id === id);
  if (!item) return;
  const step = parseInt(slider.value, 10);
  item.estimateHours = stepToHours(step);
  const label = stepToLabel(step);
  const hasEst = step > 0;
  const fillPct = Math.round((step / ESTIMATE_SCALE.max) * 100);
  // Update label + aria + fill in-place (no full re-render prevents scroll jump)
  slider.setAttribute('aria-valuetext', label);
  const wrap = slider.closest('.wdc-estimate-slider-wrap');
  if (wrap) {
    wrap.dataset.hasEstimate = String(hasEst);
    wrap.style.setProperty('--filled', fillPct + '%');
    const labelEl = wrap.querySelector('.wdc-estimate-slider-label');
    if (labelEl) labelEl.textContent = label;
  }
  updateSendBar();
}

function onBulkSliderInput(e) {
  const slider = e.target;
  if (!slider || slider.id !== 'wdd-bulk-slider') return;
  const step = parseInt(slider.value, 10);
  const label = stepToLabel(step);
  const labelEl = document.getElementById('wdd-bulk-slider-label');
  if (labelEl) labelEl.textContent = label;
  if (step === 0) return; // step 0 = "no estimate", don't apply
  _items.forEach((item) => {
    if (item.type !== 'I' && item.type !== 'N') {
      item.estimateHours = stepToHours(step);
    }
  });
  renderCanvas();
  updateSendBar();
}

// Legacy stub — kept because the drawer click handler checks data-bulk-hours; now unused
function onBulkEstimate(hours) {
  const h = parseFloat(hours);
  if (Number.isNaN(h) || h <= 0) return;
  _items.forEach((item) => {
    if (item.type !== 'I' && item.type !== 'N' && item.estimateHours == null) {
      item.estimateHours = h;
    }
  });
  renderCanvas();
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
      item.warnings = item.warnings.filter((w) => !w.toLowerCase().includes('duplicate') && !w.toLowerCase().includes('similar') && !w.toLowerCase().includes('done') && !w.toLowerCase().includes('review'));
      break;
    case 'create-anyway':
      // User explicitly overrides done-duplicate detection — clear it and mark as safe
      item.duplicate = { suggestedAction: 'createNew', primaryReason: 'user_override', key: null, similarity: null, isDoneMatch: false };
      item.warnings = item.warnings.filter((w) => !w.toLowerCase().includes('already done') && !w.toLowerCase().includes('similar') && !w.toLowerCase().includes('review'));
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
  _items.push({ id: uid(), type: 'S', title: restored.title, depth: 1, confidence: 0.5, warnings: ['Restored from ignored — review type'], duplicate: null, estimateHours: null, sourceLineIndex: restored.sourceLineIndex, selected: true });
  renderCanvas();
  updateSendBar();
}

// ─── Add-item row ─────────────────────────────────────────────────────────────

function onAddItemClick(e) {
  if (!e.target.closest('[data-add-item]')) return;
  pushUndo();
  const newItem = { id: uid(), type: 'S', title: '', depth: 1, confidence: 1, warnings: [], duplicate: null, estimateHours: null, sourceLineIndex: -1, selected: true };
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
  const safeItems = _items.filter((item) => item.type !== 'I' && item.type !== 'N' && !item.warnings.length && !hasMeaningfulDuplicate(item) && item.title.trim());
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
    // Per-item estimate hours: map of sourceLineIndex → hours
    itemEstimates: Object.fromEntries(
      safeItems.filter((i) => i.estimateHours != null && i.sourceLineIndex >= 0)
        .map((i) => [String(i.sourceLineIndex), i.estimateHours])
    ),
    // Per-item story points from Teams chat rich format
    itemStoryPoints: Object.fromEntries(
      safeItems.filter((i) => i.suggestedStoryPoints != null && i.sourceLineIndex >= 0)
        .map((i) => [String(i.sourceLineIndex), i.suggestedStoryPoints])
    ),
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
  if (!open) {
    const manualInput = pop.querySelector('#wdd-project-manual-input');
    const firstBtn = pop.querySelector('button');
    (manualInput || firstBtn)?.focus();
  }
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

function onProjectManualKeydown(e) {
  const input = e.target;
  if (!input || input.id !== 'wdd-project-manual-input') return;
  if (e.key !== 'Enter') return;
  const val = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!val || val.length < 2) return;
  _projectKey = val;
  if (!_projectOptions.includes(val)) { _projectOptions = [..._projectOptions, val]; }
  saveLastProject(_projectKey);
  const pop = document.getElementById('wdd-project-popover');
  if (pop) pop.hidden = true;
  document.getElementById('wdd-project-chip')?.setAttribute('aria-expanded', 'false');
  updateProjectChip();
  updateSendBar();
  scheduleServerDraft();
  // Focus textarea so user can start pasting immediately
  setTimeout(() => document.getElementById('wdd-source-textarea')?.focus(), 50);
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
    canvas.addEventListener('input', (e) => {
      onEstimateSliderInput(e);
      onCanvasInput(e);
    });
    canvas.addEventListener('blur', onSpBadgeBlur, true); // capture phase catches contenteditable blur
    canvas.addEventListener('focusin', onCanvasFocusin);
    canvas.addEventListener('focusout', onCanvasFocusout);
    canvas.addEventListener('click', (e) => {
      // "Use this example" button in empty canvas state
      if (e.target?.closest('[data-action="paste-example"]')) {
        const ta = document.getElementById('wdd-source-textarea');
        if (ta) {
          ta.value = '0: Clean Site Data.\n1: Reload from MIS.\n2: Validate alignment.';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.focus();
        }
        return;
      }
      onTypeChipClick(e);
      onRepairAction(e);
      onAddItemClick(e);
      onTypePickerClick(e);
      onRestoreIgnored(e);
    });
  }

  document.getElementById('wdd-create-safe-btn')?.addEventListener('click', () => createSafeIssues());
  document.getElementById('wdd-review-btn')?.addEventListener('click', toggleReviewOnly);
  document.getElementById('wdd-bulk-slider')?.addEventListener('input', onBulkSliderInput);


  // Manual project key input: Enter key confirms and sets the project
  d.addEventListener('keydown', (e) => {
    onProjectManualKeydown(e);
  });

  // Delegated handlers on the drawer element — covers dynamically injected elements
  d.addEventListener('click', (e) => {
    onProjectChipClick(e);
    onProjectSelect(e);
    // NOTE: onSettingsChange is NOT here — it's on the 'change' event to avoid double-fire on radio clicks
    onAiTestClick(e);
    onAiClearClick(e);

    // "Needs review" / "Already done" chip: scroll to first item needing attention
    if (e.target?.closest('[data-action="scroll-to-first-warning"]')) {
      const canvas = document.getElementById('wdd-canvas');
      const isDoneBtn = e.target?.closest('.wdd-send-count--done-block');
      const firstTarget = isDoneBtn
        ? canvas?.querySelector('.wdc-item[data-done-dup="true"]')
        : (canvas?.querySelector('.wdc-item .wdc-repairs')?.closest('.wdc-item'));
      if (firstTarget) {
        firstTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        firstTarget.classList.add('is-focused');
        const titleInput = firstTarget.querySelector('.wdc-title');
        if (titleInput) titleInput.focus();
        setTimeout(() => firstTarget.classList.remove('is-focused'), 1500);
      }
    }
    if (e.target?.closest('[data-action="toggle-review"]')) toggleReviewOnly();

    // Bulk estimate slider is wired via 'input' event on #wdd-bulk-slider (see wireEvents)

    // Skip all done duplicates at once
    if (e.target?.closest('#wdd-skip-all-done-btn, [data-action="skip-all-done"]')) {
      skipAllDoneDuplicates();
    }

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
