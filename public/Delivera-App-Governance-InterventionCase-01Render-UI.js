import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  seedFromBrief,
  loadCase,
  approveDraft,
  renderGovCaseCard,
  renderGovCaseDetail,
  renderGovInterventionSummary,
} from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';

const mountTokens = new WeakMap();

export async function mountGovernanceInterventionCases({ mount, brief, projectsCsv = '', periodKey = '' } = {}) {
  if (!mount || !brief) return;
  const token = Symbol('intervention-render');
  mountTokens.set(mount, token);
  mount.hidden = false;
  mount.innerHTML = `
    <section class="gov-intervention-stream gov-intervention-stream--loading" aria-label="What needs my attention">
      <div class="gov-intervention-skeleton"></div>
      <div class="gov-intervention-skeleton"></div>
    </section>`;
  try {
    const seeded = await seedFromBrief({ brief, projectsCsv, periodKey });
    if (mountTokens.get(mount) !== token) return;
    const cases = Array.isArray(seeded.cases) ? seeded.cases : [];
    mount.innerHTML = renderGovInterventionSummary(cases);
    mount.hidden = !cases.length;
  } catch (err) {
    if (mountTokens.get(mount) !== token) return;
    mount.hidden = false;
    mount.innerHTML = `
      <section class="gov-intervention-stream gov-intervention-stream--empty" aria-label="What needs my attention">
        <p class="gov-intervention-eyebrow">What needs my attention?</p>
        <h2>Intervention stream paused</h2>
        <p>${escapeHtml(err.message || 'Could not prepare intervention cases right now.')}</p>
      </section>`;
  }

  mount.onclick = async (event) => {
    const button = event.target.closest('[data-case-action]');
    if (!button) return;
    const caseId = button.getAttribute('data-case-id');
    const action = button.getAttribute('data-case-action');
    const detail = mount.querySelector(`[data-case-detail="${CSS.escape(caseId)}"]`);
    if (!caseId || !detail) return;
    button.disabled = true;
    try {
      if (action === 'details') {
        const row = await loadCase(caseId);
        detail.innerHTML = renderGovCaseDetail(row);
        detail.hidden = !detail.hidden;
      }
      if (action === 'review') {
        const data = await approveDraft(caseId, false);
        detail.innerHTML = renderGovCaseDetail(data.case, data.draft);
        detail.hidden = false;
      }
      if (action === 'confirm-send') {
        const data = await approveDraft(caseId, true);
        detail.innerHTML = `<p class="gov-intervention-sent">Approved and queued for existing channel follow-up. Receipt: ${escapeHtml(data.receipt?.id || 'ready')}</p>`;
        detail.hidden = false;
        button.closest('.gov-intervention-card')?.setAttribute('data-case-sent', 'true');
      }
    } catch (err) {
      detail.innerHTML = `<p class="gov-intervention-error">${escapeHtml(err.message || 'Action failed')}</p>`;
      detail.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
}

// Re-export for legacy imports
export { renderGovCaseCard as renderCaseCard };
