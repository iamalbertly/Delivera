/**
 * Portfolio AI agent badge — visible learning/processing indicator (mockup sparkle parity).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolveAiTrustDisplay } from './Delivera-AI-Trust-Display-01SSOT.js';

export function renderPortfolioAiAgentBadge({
  mode = 'learning',
  label = 'AI agent learning from squad data',
  compact = false,
} = {}) {
  const cls = compact ? ' portfolio-ai-agent-badge--compact' : '';
  return `
    <span class="portfolio-ai-agent-badge${cls}" data-ai-agent-badge data-ai-mode="${escapeHtml(mode)}" role="status">
      <span class="portfolio-ai-agent-pulse" aria-hidden="true"></span>
      <span class="portfolio-ai-agent-sparkle" aria-hidden="true">✦</span>
      <span class="portfolio-ai-agent-text">${escapeHtml(label)}</span>
    </span>`;
}

export async function resolvePortfolioAiAgentLabel(decision = {}) {
  const wording = decision?.trust?.wordingSource;
  try {
    const trust = await resolveAiTrustDisplay();
    if (trust.mode === 'server') {
      return { mode: 'server', label: 'AI agent learning from live Jira & portfolio signals' };
    }
    if (trust.mode === 'browser') {
      return { mode: 'browser', label: 'AI agent — browser-assisted analysis active' };
    }
  } catch (_) { /* ignore */ }
  if (wording === 'openrouter' || wording === 'ai') {
    return { mode: 'server', label: 'AI agent synthesizing portfolio signal' };
  }
  return { mode: 'template', label: 'AI agent — template baseline (enable AI in Settings)' };
}

export async function mountPortfolioAiAgentBadge(host, decision = {}, opts = {}) {
  if (!host) return;
  const { mode, label } = await resolvePortfolioAiAgentLabel(decision);
  host.innerHTML = renderPortfolioAiAgentBadge({ mode, label, compact: opts.compact });
}
