const BOARDS_WARM_KEY = 'warm:current-sprint:boards:v1';
const BOARDS_WARM_MAX_AGE_MS = 5 * 60 * 1000;

function readStore(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeStore(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value || {}));
  } catch (_) {}
}

export function readWarmBoards(projectKey) {
  const cleaned = String(projectKey || '').trim();
  if (!cleaned) return null;
  const store = readStore(BOARDS_WARM_KEY);
  const entry = store[cleaned];
  if (!entry || typeof entry !== 'object') return null;
  const cachedAt = Number(entry.cachedAt || 0);
  if (!Number.isFinite(cachedAt) || cachedAt <= 0 || (Date.now() - cachedAt) > BOARDS_WARM_MAX_AGE_MS) {
    return null;
  }
  return entry.payload || null;
}

export function writeWarmBoards(projectKey, payload) {
  const cleaned = String(projectKey || '').trim();
  if (!cleaned || !payload || typeof payload !== 'object') return;
  const store = readStore(BOARDS_WARM_KEY);
  store[cleaned] = {
    cachedAt: Date.now(),
    payload,
  };
  writeStore(BOARDS_WARM_KEY, store);
}

export function warmCurrentSprintJourney(projectKeys = []) {
  const normalized = Array.isArray(projectKeys)
    ? projectKeys
    : String(projectKeys || '').split(',');
  const firstProject = normalized.map((value) => String(value || '').trim()).find(Boolean);
  if (!firstProject) return;

  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (work) => setTimeout(work, 120);

  schedule(async () => {
    try {
      const response = await fetch(`/api/boards.json?projects=${encodeURIComponent(firstProject)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const body = await response.json().catch(() => null);
      if (!body || !Array.isArray(body.boards)) return;
      writeWarmBoards(firstProject, body);
    } catch (_) {}
  });
}
