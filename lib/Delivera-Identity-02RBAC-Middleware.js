import { attachIdentityContext } from './Delivera-Identity-01Context-SSOT.js';

export function hasPermission(identity, permission) {
  const permissions = identity?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function requirePermission(permission) {
  return [
    attachIdentityContext,
    (req, res, next) => {
      if (hasPermission(req.identity, permission)) return next();
      return res.status(403).json({
        error: 'Forbidden',
        code: 'EVIDENCE_OS_PERMISSION_DENIED',
        requiredPermission: permission,
      });
    },
  ];
}

export function canReadUserScopedRecord(identity, record = {}) {
  if (!identity || identity.orgId !== record.organizationId) return false;
  if (identity.permissions?.includes('*')) return true;
  const owner = record.userId || record.employeeUserId || record.createdByUserId;
  return owner === identity.userId || identity.reporteeIds?.includes(owner) || identity.roles?.includes('manager');
}

