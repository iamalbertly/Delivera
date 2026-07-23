import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cache } from './cache.js';
import { piImportError } from './Delivera-Governance-PIArtifact-Contracts-01SSOT.js';

function secret() {
  const configured = process.env.PI_IMPORT_SIGNING_SECRET || process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw piImportError(
      'PI_IMPORT_SIGNING_SECRET_REQUIRED',
      'Secure artifact processing is not configured.',
      503,
      true,
    );
  }
  return 'delivera-local-import-only';
}

function signature(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createPIImportUploadToken({ jobId, organizationId, artifactHash, actor }) {
  const payload = Buffer.from(JSON.stringify({
    jobId, organizationId, artifactHash, actor,
    nonce: randomUUID(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export async function consumePIImportUploadToken(token) {
  const [payload, supplied] = String(token || '').split('.');
  const expected = signature(payload || '');
  const valid = supplied && supplied.length === expected.length
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) throw piImportError('PI_IMPORT_TOKEN_INVALID', 'This upload receipt is invalid.', 401);
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (_) {
    throw piImportError('PI_IMPORT_TOKEN_INVALID', 'This upload receipt is invalid.', 401);
  }
  if (claims.expiresAt < Date.now()) throw piImportError('PI_IMPORT_TOKEN_EXPIRED', 'This upload receipt expired. Prepare the file again.', 401, true);
  const lease = await cache.claimLease(claims.nonce, 15 * 60 * 1000, { namespace: 'pi-import-token-used' });
  if (!lease.acquired) throw piImportError('PI_IMPORT_TOKEN_REPLAYED', 'This one-use upload receipt was already used.', 409);
  return claims;
}
