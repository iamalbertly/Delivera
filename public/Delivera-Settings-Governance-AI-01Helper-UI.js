/**
 * Settings — honest AI unlock helper for Governance Brief narration.
 * Reuses Work Draft session key storage (browser-only).
 */
const AI_PROVIDER_SESSION_KEY = 'wdd_ai_provider_v1';

function readAi() {
  try { return JSON.parse(window.sessionStorage.getItem(AI_PROVIDER_SESSION_KEY) || 'null') || {}; } catch (_) { return {}; }
}

function saveAi(data) {
  try { window.sessionStorage.setItem(AI_PROVIDER_SESSION_KEY, JSON.stringify(data)); } catch (_) {}
}

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mountGovernanceAiHelper(mount) {
  if (!mount) return;

  function render() {
    const ai = readAi();
    const hasKey = Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
    mount.innerHTML = `
      <section id="gov-ai-helper" class="surface-card gov-ai-helper-card">
        <h2>Governance Brief — AI wording</h2>
        <p class="gov-ai-helper-lead">Delivera always shows evidence-backed facts. AI only rewrites the meeting answer into clearer language — it does not invent risks or counts.</p>
        ${hasKey
    ? `<p class="gov-ai-helper-status gov-ai-helper-status--ok">Your key is stored in this browser session only. Built-in template wording is used if the provider fails.</p>`
    : `<p class="gov-ai-helper-status">No key yet — Brief uses the built-in template. Add a key to unlock advisor-style narration.</p>`}
        <label class="gov-ai-helper-field">
          <span>Provider</span>
          <select id="gov-ai-provider" class="gov-ai-helper-select">
            <option value="built-in" ${ai.provider === 'built-in' || !ai.provider ? 'selected' : ''}>Built-in template (no key)</option>
            <option value="openai" ${ai.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
          </select>
        </label>
        <label class="gov-ai-helper-field">
          <span>API key (session only)</span>
          <input type="password" id="gov-ai-key" class="gov-ai-helper-input" placeholder="sk-…" autocomplete="off" value="${hasKey ? '●●●●●●●●' : ''}">
        </label>
        <div class="gov-ai-helper-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-ai-save">Save for this session</button>
          <button type="button" class="btn btn-secondary btn-compact" id="gov-ai-test">Test connection</button>
          <button type="button" class="btn btn-link btn-compact" id="gov-ai-clear">Clear key</button>
        </div>
        <p id="gov-ai-test-result" class="gov-ai-helper-result" aria-live="polite"></p>
      </section>`;

    mount.querySelector('#gov-ai-save')?.addEventListener('click', () => {
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const key = raw.includes('●') ? (readAi().key || '') : raw.trim();
      saveAi({ provider, key: provider === 'built-in' ? '' : key });
      render();
    });

    mount.querySelector('#gov-ai-clear')?.addEventListener('click', () => {
      saveAi({ provider: 'built-in', key: '' });
      render();
    });

    mount.querySelector('#gov-ai-test')?.addEventListener('click', async () => {
      const result = mount.querySelector('#gov-ai-test-result');
      const ai = readAi();
      if (!ai.key || ai.provider === 'built-in') {
        if (result) result.textContent = 'Built-in template is always available — no test needed.';
        return;
      }
      if (result) result.textContent = 'Testing…';
      try {
        const res = await fetch('/api/settings/ai-provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ai-key': ai.key, 'x-ai-provider': ai.provider },
          body: JSON.stringify({ action: 'test', provider: ai.provider }),
        });
        const data = await res.json().catch(() => ({}));
        if (result) {
          result.textContent = res.ok
            ? `OK — ${escapeHtml(data.message || 'Provider responded')}`
            : `Failed — ${escapeHtml(data.error || res.status)}`;
        }
      } catch (err) {
        if (result) result.textContent = `Failed — ${err.message}`;
      }
    });
  }

  render();
}
