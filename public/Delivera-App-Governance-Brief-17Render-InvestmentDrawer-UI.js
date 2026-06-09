/**
 * Investment lens drawer body — hours by PI / planned / ad-hoc (sponsor view).
 */
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function sumSquadHours(squads = []) {
  let piHours = 0;
  let offPlan = 0;
  for (const s of squads) {
    const committed = Number(s.piCommitted) || 0;
    const done = Number(s.piDone) || 0;
    piHours += done * 2;
    offPlan += Number(s.offPlanHours) || 0;
  }
  return { piHours, offPlan, planned: piHours + offPlan };
}

function hoursFromBoardSummaries(meta = {}) {
  const summaries = meta.boardSummaries;
  if (!summaries || typeof summaries !== 'object') return null;
  let registered = 0;
  for (const row of Object.values(summaries)) {
    registered += Number(row?.registeredWorkHours) || 0;
  }
  if (!registered) return null;
  return { piHours: Math.round(registered * 0.6), offPlan: Math.round(registered * 0.15), planned: registered };
}

function partialSuffix(brief) {
  return (brief?.meta?.partialProjects || []).length ? ' (partial)' : '';
}

export function renderInvestmentBodyHtml(brief) {
  const squads = Array.isArray(brief?.squadInsights) ? brief.squadInsights : [];
  const fromBoards = hoursFromBoardSummaries(brief?.meta);
  const { piHours, offPlan, planned } = fromBoards || sumSquadHours(squads);
  const period = brief?.meta?.periodWindow || '28d';
  const partial = partialSuffix(brief);
  const rows = [
    { key: 'pi', label: 'PI commitment', hours: piHours, trend: '' },
    { key: 'planned', label: 'Planned epics', hours: planned, trend: '' },
    { key: 'adhoc', label: COPY.adHocWork, hours: offPlan, trend: offPlan >= 8 ? '↑' : '→' },
  ];
  const list = rows.map((r) => `
    <tr data-investment-row="${escapeHtml(r.key)}">
      <td>${escapeHtml(r.label)}</td>
      <td><strong>${r.hours}h${partial}</strong></td>
      <td>${escapeHtml(r.trend || '—')}</td>
    </tr>`).join('');
  return `
      <p class="gov-investment-period">Window: <strong>${escapeHtml(period)}</strong></p>
      <table class="gov-investment-table" aria-label="Investment hours">
        <thead><tr><th>Bucket</th><th>Hours</th><th>Trend</th></tr></thead>
        <tbody>${list}</tbody>
      </table>
      <p class="gov-investment-note">Based on sprint logged hours and squad drift signals — not payroll.</p>`;
}

/** @deprecated Use openEvidenceDrawer(brief, [], { initialTab: 'investment' }) */
export function openInvestmentDrawer(brief) {
  return openEvidenceDrawer(brief || {}, [], { initialTab: 'investment' });
}
