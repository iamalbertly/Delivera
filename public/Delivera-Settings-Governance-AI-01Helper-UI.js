/**
 * Settings — AI keys (browser-only) for narration, Create work, and PI slide reading.
 */
import {
  readAiProviderPref,
  saveAiProviderPref,
  clearAiProviderPref,
  invalidateAiStatusCache,
  emitAiCapabilityChanged,
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

export function mountGovernanceAiHelper(mount, options = {}) {
  if (!mount) return;
  const embedded = Boolean(options.embedded);

  async function render() {
    const ai = readAiProviderPref();
    const hasKey = Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
    const trust = await resolveAiTrustDisplay({ forceStatus: true });
    const titleHtml = embedded ? '' : '<h2>Connections</h2>';
    const leadHtml = embedded
      ? ''
      : '<p class="gov-ai-helper-lead">Browser keys stay local. Server AI is configured by your administrator in <code>.env</code>. Jira uses your login session.</p>';

    mount.innerHTML = `
      <div id="gov-ai-helper" class="gov-ai-helper-card${embedded ? ' gov-ai-helper-card--embedded' : ''}">
        ${titleHtml}
        ${leadHtml}

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
      </div>`;

    const saveBtn = mount.querySelector('#gov-ai-save');
    const syncSaveDisabled = () => {
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const key = raw.includes('●') ? (readAiProviderPref().key || '') : raw.trim();
      const serverCovers = Boolean(trust.slideVisionReady && !hasKey);
      if (saveBtn) {
        saveBtn.disabled = provider !== 'built-in' && !key && !serverCovers;
      }
    };
    syncSaveDisabled();
    mount.querySelector('#gov-ai-provider')?.addEventListener('change', syncSaveDisabled);
    mount.querySelector('#gov-ai-key')?.addEventListener('input', syncSaveDisabled);

    saveBtn?.addEventListener('click', () => {
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const prior = readAiProviderPref();
      const key = raw.includes('●') ? (prior.key || '') : raw.trim();
      const keyUnchanged = key && key === prior.key && provider === prior.provider;
      saveAiProviderPref({
        provider,
        key: provider === 'built-in' ? '' : key,
        lastTestOk: provider === 'built-in' ? false : (keyUnchanged ? prior.lastTestOk : false),
        lastTestAt: keyUnchanged ? prior.lastTestAt : null,
      });
      invalidateAiStatusCache();
      emitAiCapabilityChanged();
      render();
    });

    mount.querySelector('#gov-ai-clear')?.addEventListener('click', () => {
      clearAiProviderPref();
      invalidateAiStatusCache();
      emitAiCapabilityChanged();
      render();
    });

    mount.querySelector('#gov-ai-test')?.addEventListener('click', async () => {
      const result = mount.querySelector('#gov-ai-test-result');
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const prior = readAiProviderPref();
      const key = raw.includes('●') ? (prior.key || '') : raw.trim();
      if (!key || provider === 'built-in') {
        if (result) result.textContent = 'Built-in template is always available.';
        return;
      }
      if (result) result.textContent = 'Testing…';
      try {
        const res = await fetch('/api/settings/ai-provider', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ai-key': key,
            'x-ai-provider': provider,
            'x-ai-override': '1',
          },
          body: JSON.stringify({ action: 'test', provider }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          saveAiProviderPref({
            provider,
            key,
            lastTestOk: true,
            lastTestAt: new Date().toISOString(),
          });
          invalidateAiStatusCache();
          emitAiCapabilityChanged();
        }
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
