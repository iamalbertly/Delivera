import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

function agentBlock(agent) {
  const items = (agent.items || []).map((it) => `
    <li>
      <strong>${escapeHtml(it.summary || '')}</strong>
      <p>${escapeHtml(it.change || '')}</p>
      <span class="gov-feedback-why">${escapeHtml(it.why || '')}</span>
    </li>`).join('');
  return `
    <section class="gov-feedback-agent">
      <h4>${escapeHtml(agent.agent || '')} <span class="gov-feedback-count">${agent.count || 0}</span></h4>
      <p class="gov-feedback-agent-label">${escapeHtml(agent.label || '')}</p>
      <ul>${items}</ul>
    </section>`;
}

export async function openFeedbackImprovementCenter(project = '') {
  let summary = { agents: [], total: 0, lastImprovements: [] };
  try {
    const qs = project ? `?projects=${encodeURIComponent(project)}` : '';
    const res = await fetch(`/api/governance/feedback-summary.json${qs}`, { credentials: 'include' });
    if (res.ok) summary = await res.json();
  } catch (_) { /* empty */ }

  const userFeedbackHtml = (summary.recentUserFeedback || []).length
    ? `<section class="gov-feedback-recent" aria-label="Recent user feedback">
        <h4>Recent submissions</h4>
        <ul>${(summary.recentUserFeedback || []).map((row) => `
          <li>
            <strong>${escapeHtml(row.message || '')}</strong>
            <span class="gov-feedback-why">${escapeHtml([row.page, row.squad, row.issueKey].filter(Boolean).join(' · '))}</span>
          </li>`).join('')}
        </ul>
      </section>`
    : '';

  const body = `
    <p class="gov-feedback-intro">Feedback routes to sub-agents — no LLM in this path.</p>
    <p>Total signals: <strong>${summary.total || 0}</strong></p>
    ${userFeedbackHtml}
    ${(summary.lastImprovements || []).map((l) => `<p class="gov-feedback-last">· ${escapeHtml(l)}</p>`).join('')}
    ${(summary.agents || []).map(agentBlock).join('')}
    <form id="gov-feedback-form" class="gov-feedback-form">
      <label>Phrase to accept <input type="text" name="phrase" maxlength="240" /></label>
      <button type="submit" class="btn btn-primary btn-compact">Send to Phrase Agent</button>
    </form>`;

  const { close, el } = openRightDrawer({ title: 'Feedback improvement lab', bodyHtml: body });

  el?.querySelector('#gov-feedback-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const phrase = ev.target.phrase?.value?.trim();
    if (!phrase) return;
    await fetch('/api/governance/feedback-triage', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase, source: 'feedback-lab' }),
    });
    close();
    openFeedbackImprovementCenter(project);
  });

  return { close, el };
}

export function mountFeedbackLabButton(mount, project, summary = null) {
  if (!mount) return;
  const total = summary?.total ?? 0;
  if (total === 0) {
    mount.innerHTML = '';
    mount.hidden = true;
    return;
  }
  mount.hidden = false;
  const dim = total === 0 ? ' gov-lab-chip--dim' : '';
  const countBadge = total > 0 ? `<span class="gov-lab-count">${total}</span>` : '';
  mount.innerHTML = `<button type="button" class="gov-lab-chip${dim}" id="gov-open-feedback-lab" aria-label="Improve brief from feedback">
    <span class="gov-lab-icon" aria-hidden="true">⚗</span>
    <span class="gov-lab-label">Improve brief</span>
    ${countBadge}
  </button>`;
  mount.querySelector('#gov-open-feedback-lab')?.addEventListener('click', () => {
    openFeedbackImprovementCenter(project);
  });
}
