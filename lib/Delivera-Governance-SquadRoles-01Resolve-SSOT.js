/**
 * SSOT: Hybrid squad role resolver (profile overrides → Jira custom fields).
 * Pure resolution — no IO in hot path when overrides are preloaded.
 */

function asPerson(value, source) {
  if (!value) return null;
  if (typeof value === 'string') {
    const displayName = value.trim();
    if (!displayName) return null;
    return { displayName, accountId: '', source };
  }
  const displayName = String(value.displayName || value.name || '').trim();
  if (!displayName) return null;
  return {
    displayName,
    accountId: String(value.accountId || '').trim(),
    source,
  };
}

function roleFromProfileOverrides(projectKey, overrides = []) {
  const PK = String(projectKey || '').trim().toUpperCase();
  let scrumMaster = null;
  let productOwner = null;
  for (const row of overrides) {
    if (!row) continue;
    const { kind, key } = parseScope(row.scope);
    if (kind !== 'project' || String(key).toUpperCase() !== PK) continue;
    const k = String(row.key || '').trim();
    if (k === 'scrumMaster' && !scrumMaster) scrumMaster = asPerson(row.value, 'profile');
    if (k === 'productOwner' && !productOwner) productOwner = asPerson(row.value, 'profile');
  }
  return { scrumMaster, productOwner };
}

function parseScope(scope) {
  const s = String(scope || '').trim();
  const [kind, key] = s.split(':');
  return { kind: kind || 'global', key: key || '*' };
}

function roleFromJiraFields(projectKey, jiraProjectFields = {}) {
  const PK = String(projectKey || '').trim().toUpperCase();
  const fields = jiraProjectFields[PK] || jiraProjectFields[projectKey] || {};
  const scrumMaster = asPerson(fields.scrumMaster, 'jira');
  const productOwner = asPerson(fields.productOwner, 'jira');
  return { scrumMaster, productOwner };
}

/**
 * @param {object} args
 * @param {string} args.projectKey
 * @param {Array} [args.profileOverrides]
 * @param {object} [args.jiraProjectFields]
 * @returns {{ scrumMaster: object|null, productOwner: object|null }}
 */
/**
 * Build per-project SM/PO from env field IDs and board payload custom fields.
 * @param {Array} boardPayloads
 * @returns {object|null}
 */
export function buildJiraProjectFieldsFromPayloads(boardPayloads = []) {
  const smField = String(process.env.GOV_SM_FIELD_ID || '').trim();
  const poField = String(process.env.GOV_PO_FIELD_ID || '').trim();
  if (!smField && !poField) return null;
  const out = {};
  for (const entry of boardPayloads) {
    const pk = String(
      entry?.board?.location?.projectKey
      || entry?.payload?.meta?.projects?.split?.(',')[0]
      || '',
    ).trim().toUpperCase();
    if (!pk) continue;
    const custom = entry?.payload?.meta?.projectCustomFields || {};
    out[pk] = {
      scrumMaster: smField ? custom[smField] : null,
      productOwner: poField ? custom[poField] : null,
    };
  }
  return Object.keys(out).length ? out : null;
}

export function resolveSquadRoles({
  projectKey = '',
  profileOverrides = [],
  jiraProjectFields = null,
} = {}) {
  const fromProfile = roleFromProfileOverrides(projectKey, profileOverrides);
  const fromJira = jiraProjectFields ? roleFromJiraFields(projectKey, jiraProjectFields) : { scrumMaster: null, productOwner: null };
  return {
    scrumMaster: fromProfile.scrumMaster || fromJira.scrumMaster,
    productOwner: fromProfile.productOwner || fromJira.productOwner,
  };
}
