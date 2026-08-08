import { loadActiveGovernanceLoop } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260729k';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

// Paint last-known portfolio truth before the full Governance controller and
// secondary tools hydrate. The ActiveLoop loader owns cache validation and
// single-flight network refresh, so this creates no second truth path.
const params = new URL(location.href).searchParams;
let projects = String(params.get('projects') || params.get('squad') || '').trim();
if (!projects) {
  try { projects = String(localStorage.getItem(PROJECTS_SSOT_KEY) || '').trim(); } catch (_) { projects = ''; }
}
const quarter = String(params.get('quarter') || '').trim();
if (projects) void loadActiveGovernanceLoop({ projects, quarter });
