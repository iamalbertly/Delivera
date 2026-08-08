import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { clearGovernanceClientCaches } from './Delivera-Shared-Release-Cache-Guard-01SSOT.js';
import * as AiTrustDisplay from './Delivera-AI-Trust-Display-01SSOT.js?v=20260729a';
import { renderHealthTileStrip } from './Delivera-Shared-Health-Tile-01Render.js';
import {
  readAiProviderPref,
  saveAiProviderPref,
  clearAiProviderPref,
} from './Delivera-Shared-AI-Provider-Pref-01Helper.js';

/**
 * Settings — AI keys (browser-only) for narration, Create work, and PI slide reading.
 */
const {
  resolveAiTrustDisplay,
  AI_USED_FOR = [],
  AI_NEVER_FOR = [],
} = AiTrustDisplay;

function clearActiveLoopClientCaches() {
  clearGovernanceClientCaches();
  try {
    import('./Delivera-App-Governance-ActiveLoop-01UI.js?v=20260729k')
      .then((mod) => { if (typeof mod.clearActiveLoopCaches === 'function') mod.clearActiveLoopCaches(); })
      .catch(() => {});
  } catch (_) { /* ignore */ }
}

export function mountGovernanceAiHelper(mount) {
  if (!mount) return;

  async function render() {
    const ai = readAiProviderPref();
    const hasKey = Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
    const [trust, intelligence] = await Promise.all([
      resolveAiTrustDisplay({ forceStatus: true }),
      fetch('/api/governance/intelligence/health', { headers: { Accept: 'application/json' } })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null),
    ]);
    const quota = intelligence?.quota || {};
    const circuits = Array.isArray(intelligence?.circuits) ? intelligence.circuits : [];
    const openCircuits = circuits.filter((item) => item.state === 'open').length;
    const cacheNamespaces = Number(intelligence?.cache?.namespaceCount || 0);

    mount.innerHTML = `
      <section id="gov-ai-helper" class="surface-card gov-ai-helper-card">
        <h2>Processing intelligence</h2>
        <p class="gov-ai-helper-lead">Local extraction and the shared cache protect speed and quota. External models receive only unresolved evidence.</p>
        ${renderHealthTileStrip([
          { label: 'Worker', value: intelligence?.worker || 'Unavailable', lineBreak: true },
          { label: 'Daily allowance', value: `${Number(quota.remaining || 0)} of ${Number(quota.ceiling || 0)} left`, lineBreak: true },
          { label: 'Shared cache', value: `${cacheNamespaces} active namespaces`, lineBreak: true },
          { label: 'Provider circuits', value: openCircuits ? `${openCircuits} open` : 'All closed', lineBreak: true },
        ], { ariaLabel: 'Processing intelligence health' })}
        <p class="gov-ai-helper-note">Roles: ${escapeHtml(intelligence?.modelRoles?.ocr || 'local OCR')} → ${escapeHtml(intelligence?.modelRoles?.visualStructure || 'visual review')} → ${escapeHtml(intelligence?.modelRoles?.reconciliation || 'human review')}. Reset ${escapeHtml(quota.resetAt ? new Date(quota.resetAt).toLocaleString() : 'when provider capacity returns')}.</p>

        <h3 class="gov-ai-helper-sub">AI reasoning layer</h3>
        ${trust.statusLineHtml}
        ${trust.usageLineHtml || ''}
        <details><summary>Trust boundaries</summary><div class="gov-ai-helper-lists">
          <div>
            <strong>Used for:</strong>
            <ul class="gov-ai-helper-used">${AI_USED_FOR.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
          </div>
          <div>
            <strong>Never used for:</strong>
            <ul class="gov-ai-helper-never">${AI_NEVER_FOR.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
          </div>
        </div></details>

        <details class="gov-ai-admin-diagnostics">
        <summary>Super-admin provider diagnostics${hasKey ? ' · override configured' : ''}</summary>
        <h3 class="gov-ai-helper-sub">Browser override (optional)</h3>
        <label class="gov-ai-helper-field">
          <span>Provider</span>
          <select id="gov-ai-provider" class="gov-ai-helper-select" autocomplete="off">
            <option value="built-in" ${ai.provider === 'built-in' || !ai.provider ? 'selected' : ''}>Built-in (no key)</option>
            <option value="openai" ${ai.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="claude" ${ai.provider === 'claude' ? 'selected' : ''}>Claude</option>
            <option value="gemini" ${ai.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="openrouter" ${ai.provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
          </select>
        </label>
        <label class="gov-ai-helper-field">
          <span>API key</span>
          <input type="password" id="gov-ai-key" name="delivera-provider-override" class="gov-ai-helper-input" placeholder="${hasKey ? 'Configured · enter a replacement only' : 'Paste key…'}" autocomplete="new-password" data-1p-ignore data-lpignore="true" value="">
        </label>
        <div class="gov-ai-helper-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-ai-save">Save in browser</button>
          <button type="button" class="btn btn-secondary btn-compact" id="gov-ai-test">Test</button>
          <button type="button" class="btn btn-link btn-compact" id="gov-ai-clear">Clear</button>
        </div>
        <p id="gov-ai-test-result" class="gov-ai-helper-result" aria-live="polite"></p>
        </details>

        <h3 class="gov-ai-helper-sub">Jira</h3>
        <p class="gov-ai-helper-note">Jira credentials are configured by your administrator in environment variables. If boards look empty or you still see old access errors after fixing credentials, refresh the connection below (clears stale caches).<br />Setup guide: <a href="https://admin.atlassian.com/o/43a976a6-3176-4e09-bc38-3cf6d6eb4fa3/api-keys" target="_blank" rel="noreferrer noopener">Atlassian API key setup</a>.</p>
        <div class="gov-ai-helper-actions">
          <button type="button" class="btn btn-primary btn-compact" id="gov-jira-refresh-connection">Refresh Jira connection</button>
        </div>
        <p id="gov-jira-refresh-result" class="gov-ai-helper-result" aria-live="polite"></p>
      </section>`;

    mount.querySelector('#gov-ai-save')?.addEventListener('click', () => {
      const provider = mount.querySelector('#gov-ai-provider')?.value || 'built-in';
      const keyInput = mount.querySelector('#gov-ai-key');
      const raw = keyInput?.value || '';
      const key = raw.trim() || (hasKey ? (readAiProviderPref().key || '') : '');
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

    mount.querySelector('#gov-jira-refresh-connection')?.addEventListener('click', async () => {
      const result = mount.querySelector('#gov-jira-refresh-result');
      const button = mount.querySelector('#gov-jira-refresh-connection');
      if (button) button.disabled = true;
      if (result) result.textContent = 'Checking Jira and clearing stale caches…';
      try {
        const res = await fetch('/api/settings/jira-connection/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          if (result) result.textContent = `Refresh incomplete — ${data.error || res.status}`;
          return;
        }
        clearActiveLoopClientCaches();
        const projectAccess = Array.isArray(data.projectAccess) ? data.projectAccess : [];
        const unresolved = projectAccess.filter((item) => item.state !== 'verified');
        if (result) {
          result.textContent = data.displayName
            ? `Connected as ${data.displayName}. ${data.projectsChecked || projectAccess.length} projects checked${unresolved.length ? `; ${unresolved.length} need board mapping or a retry` : '; all visible boards verified'}. Opening refreshed Brief…`
            : (data.message || 'Jira connection refreshed.');
        }
        const current = new URL(window.location.href);
        const squad = current.searchParams.get('squad') || current.searchParams.get('projects')?.split(',')[0] || '';
        const target = new URL('/governance', window.location.origin);
        if (squad) {
          target.searchParams.set('spotlight', squad);
          target.searchParams.set('view', 'squad');
        }
        target.searchParams.set('jiraRefresh', String(Date.now()));
        window.setTimeout(() => window.location.assign(target), 350);
      } catch (err) {
        if (result) result.textContent = `Failed — ${err.message}`;
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  render();
}
