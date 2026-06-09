/**
 * Settings — AI keys (browser-only) for narration, Create work, and PI slide reading.
 */
import {
  readAiProviderPref,
  saveAiProviderPref,
  clearAiProviderPref,
} from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { resolveAiTrustDisplay } from './Delivera-AI-Trust-Display-01SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

const AI_USED_FOR = [
  'Clearer Brief wording',
  'PI baseline classification',
  'Simple Mode copy',
  'Feedback improvement proposals',
  'Grouped nudge drafts',
];

const AI_NEVER_FOR = [
  'Jira writes',
  'Final counts',
  'Confirmed PI baseline',
  'Owner facts',
  'Risk truth',
];

export function mountGovernanceAiHelper(mount) {
  if (!mount) return;

  async function render() {
    const ai = readAiProviderPref();
    const hasKey = Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
    const trust = await resolveAiTrustDisplay({ forceStatus: true });

    mount.innerHTML = `
      <section id="gov-ai-helper" class="surface-card gov-ai-helper-card">
        <h2>Connections</h2>
        <p class="gov-ai-helper-lead">Browser keys stay local. Server AI is configured by your administrator in <code>.env</code>. Jira uses your login session.</p>

        <h3 class="gov-ai-helper-sub">AI reasoning layer</h3>
        ${trust.statusLineHtml}
        ${trust.usageLineHtml || ''}
        <div class="gov-ai-helper-lists">
          <div>
            <strong>Used for:</strong>
            <ul class="gov-ai-helper-used">${AI_USED_FOR.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
          </div>
          <div>
            <strong>Never used for:</strong>
            <ul class="gov-ai-helper-never">${AI_NEVER_FOR.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
          </div>
        </div>

        <h3 class="gov-ai-helper-sub">Browser override (optional)</h3>
        <label class="gov-ai-helper-field">
          <span>Provider</span>
          <select id="gov-ai-provider" class="gov-ai-helper-select">
            <option value="built-in" ${ai.provider === 'built-in' || !ai.provider ? 'selected' : ''}>Built-in (no key)</option>
            <option value="openai" ${ai.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="claude" ${ai.provider === 'claude' ? 'selected' : ''}>Claude</option>
            <option value="gemini" ${ai.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="openrouter" ${ai.provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
          </select>
        </label>
        <label class="gov-ai-helper-field">
          <span>API key</span>
          <input type="password" id="gov-ai-key" class="gov-ai-helper-input" placeholder="Paste key…" autocomplete="off" value="${hasKey ? '●●●●●●●●' : ''}">
        </label>
        <div class="gov-ai-helper-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-ai-save">Save in browser</button>
          <button type="button" class="btn btn-secondary btn-compact" id="gov-ai-test">Test</button>
          <button type="button" class="btn btn-link btn-compact" id="gov-ai-clear">Clear</button>
        </div>
        <p id="gov-ai-test-result" class="gov-ai-helper-result" aria-live="polite"></p>

        <h3 class="gov-ai-helper-sub">Jira</h3>
        <p class="gov-ai-helper-note">Jira credentials are configured by your administrator in environment variables. If boards look empty, check project access and refresh the Brief.</p>
      </section>`;

    mount.querySelector('#gov-ai-save')?.addEventListener('click', () => {
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const key = raw.includes('●') ? (readAiProviderPref().key || '') : raw.trim();
      saveAiProviderPref({ provider, key: provider === 'built-in' ? '' : key });
      render();
    });

    mount.querySelector('#gov-ai-clear')?.addEventListener('click', () => {
      clearAiProviderPref();
      render();
    });

    mount.querySelector('#gov-ai-test')?.addEventListener('click', async () => {
      const result = mount.querySelector('#gov-ai-test-result');
      const aiPref = readAiProviderPref();
      if (!aiPref.key || aiPref.provider === 'built-in') {
        if (result) result.textContent = 'Built-in template is always available.';
        return;
      }
      if (result) result.textContent = 'Testing…';
      try {
        const res = await fetch('/api/settings/ai-provider', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ai-key': aiPref.key,
            'x-ai-provider': aiPref.provider,
          },
          body: JSON.stringify({ action: 'test', provider: aiPref.provider }),
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
