import { jiraEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { mutateEvidenceOsStore, DEFAULT_ORG_ID, evidenceOsNow } from './Delivera-EvidenceOS-00Store-IO.js';

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  individual_contributor: ['evidence:read', 'evidence:write', 'goal:read', 'goal:write', 'report:read', 'report:write'],
  manager: ['evidence:read', 'evidence:write', 'evidence:validate', 'goal:read', 'goal:write', 'report:read', 'report:write'],
  admin: ['*'],
});

function maskEmail(email = '') {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}***@${domain}`;
}

function roleKeysFromReq(req) {
  const header = String(req.get?.('x-delivera-roles') || '').split(',').map((r) => r.trim()).filter(Boolean);
  if (header.length) return header;
  if (String(req.get?.('x-delivera-manager') || '') === '1') return ['manager'];
  return ['individual_contributor'];
}

export async function resolveIdentityContext(req = {}) {
  const authId = req.authUser?.id || req.session?.user || jiraEnvConfig.email || 'local-user';
  const email = String(req.get?.('x-delivera-user-email') || (String(authId).includes('@') ? authId : jiraEnvConfig.email) || 'local@delivera.dev').toLowerCase();
  const displayName = String(req.get?.('x-delivera-user-name') || email.split('@')[0] || 'Delivera User');
  const roleKeys = roleKeysFromReq(req);

  return mutateEvidenceOsStore((store) => {
    for (const [key, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = store.roles.find((r) => r.key === key);
      if (role) role.permissions = permissions;
      else store.roles.push({ id: `role-${key}`, key, permissions });
    }
    let user = store.users.find((u) => u.email === email || u.authProviderUserId === String(authId));
    if (!user) {
      user = {
        id: `user-${Buffer.from(email).toString('base64url').slice(0, 18)}`,
        authProviderUserId: String(authId),
        email,
        displayName,
        status: 'active',
        createdAt: evidenceOsNow(),
      };
      store.users.push(user);
    }
    const existingRoleKeys = store.memberRoles.filter((r) => r.userId === user.id).map((r) => r.roleKey);
    for (const roleKey of roleKeys) {
      if (!existingRoleKeys.includes(roleKey)) {
        store.memberRoles.push({ userId: user.id, organizationId: DEFAULT_ORG_ID, roleKey, assignedAt: evidenceOsNow() });
      }
    }
    const roles = Array.from(new Set([...existingRoleKeys, ...roleKeys]));
    const permissions = new Set();
    for (const roleKey of roles) {
      const role = store.roles.find((r) => r.key === roleKey || r.id === roleKey);
      for (const permission of role?.permissions || []) permissions.add(permission);
    }
    const reporteeIds = store.managerRelationships
      .filter((rel) => rel.managerUserId === user.id && !rel.validTo)
      .map((rel) => rel.employeeUserId);
    return {
      userId: user.id,
      orgId: DEFAULT_ORG_ID,
      roles,
      permissions: Array.from(permissions),
      teamIds: store.teamMemberships.filter((t) => t.userId === user.id && !t.validTo).map((t) => t.teamId),
      reporteeIds,
      emailMasked: maskEmail(email),
      displayName,
    };
  });
}

export async function attachIdentityContext(req, _res, next) {
  try {
    req.identity = await resolveIdentityContext(req);
    next();
  } catch (error) {
    next(error);
  }
}
