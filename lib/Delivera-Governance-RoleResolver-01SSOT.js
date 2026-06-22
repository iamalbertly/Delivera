import { resolveEffectiveGovernanceProfile } from './Delivera-Governance-Profile-01Resolve-SSOT.js';
import { resolveDecisionLane } from './Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { resolveSquadRoles } from './Delivera-Governance-SquadRoles-01Resolve-SSOT.js';

function asResolved(role, person, source, confidence = 'medium') {
  if (!person?.displayName && !person?.accountId) return null;
  return {
    role,
    accountId: String(person.accountId || ''),
    displayName: String(person.displayName || person.name || role),
    source,
    confidence,
  };
}

function manualMapping(projectKey, role) {
  const raw = process.env[`DELIVERA_${String(projectKey || '').toUpperCase()}_${String(role || '').toUpperCase().replace(/\s+/g, '_')}`] || '';
  if (!raw) return null;
  return asResolved(role, { displayName: raw }, 'settings-env', 'medium');
}

export async function resolveGovernanceRole({
  projectKey = '',
  risk = {},
  role = '',
  profileOverrides = [],
  jiraProjectFields = null,
  jiraProjectRoles = {},
} = {}) {
  const lane = role || resolveDecisionLane(risk);
  const profile = await resolveEffectiveGovernanceProfile({ project: projectKey }).catch(() => null);
  const overrides = profileOverrides.length ? profileOverrides : (profile?.overrides || []);
  const squadRoles = resolveSquadRoles({ projectKey, profileOverrides: overrides, jiraProjectFields });

  if (/product owner/i.test(lane)) {
    const fromProfile = asResolved(lane, squadRoles.productOwner, 'profile-or-jira-field', squadRoles.productOwner?.source === 'profile' ? 'high' : 'medium');
    if (fromProfile) return fromProfile;
    const jiraPo = Array.isArray(jiraProjectRoles.productOwners) ? jiraProjectRoles.productOwners[0] : null;
    const fromProjectRole = asResolved(lane, jiraPo, 'jira-project-role', jiraPo ? 'medium' : 'none');
    if (fromProjectRole) return fromProjectRole;
  }

  if (/scrum master/i.test(lane)) {
    const fromProfile = asResolved(lane, squadRoles.scrumMaster, 'profile-or-jira-field', squadRoles.scrumMaster?.source === 'profile' ? 'high' : 'medium');
    if (fromProfile) return fromProfile;
  }

  const fromManual = manualMapping(projectKey, lane);
  if (fromManual) return fromManual;

  const fallback = risk.reporterName || risk.componentLead || '';
  if (fallback) return asResolved(lane, { displayName: fallback }, 'fallback-reporter-component', 'low');

  return {
    role: lane,
    accountId: '',
    displayName: '',
    source: 'unresolved',
    confidence: 'none',
  };
}

export function canSendToResolvedRole(resolved = {}) {
  return Boolean(resolved.accountId || resolved.displayName) && resolved.confidence !== 'none';
}

