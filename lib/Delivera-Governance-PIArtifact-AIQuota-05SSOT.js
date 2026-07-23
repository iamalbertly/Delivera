import { cache } from './cache.js';
import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

const TIER_TTL = 15 * 60 * 1000;
const DAY_TTL = 36 * 60 * 60 * 1000;

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function quotaKey(organizationId = 'delivera') {
  return `pi-import-quota:${organizationId}:${utcDay()}`;
}

function circuitKey(model = '') {
  return `pi-import-circuit:${model}`;
}

export async function readPIArtifactCircuit(model) {
  return (await cache.get(circuitKey(model), { namespace: 'pi-import-circuit' }))?.value || { state: 'closed', failures: 0 };
}

export async function recordPIArtifactProviderOutcome(model, { success = false, error = '' } = {}) {
  if (success) {
    await cache.delete(circuitKey(model), { namespace: 'pi-import-circuit' });
    return { state: 'closed', failures: 0 };
  }
  const current = await readPIArtifactCircuit(model);
  const detail = String(error || '');
  const failures = (current.failures || 0) + 1;
  let openMs = 0;
  if (/429|rate.?limit/i.test(detail)) openMs = 15 * 60 * 1000;
  else if (/401|403|auth|invalid.*key/i.test(detail)) openMs = 15 * 60 * 1000;
  else if (/zero data retention|data policy|\bzdr\b/i.test(detail)) openMs = 7 * 24 * 60 * 60 * 1000;
  else if (/no endpoints found/i.test(detail)) openMs = 60 * 60 * 1000;
  else if (/schema|verification/i.test(detail) && failures >= 3) openMs = 30 * 60 * 1000;
  else if (/timeout|5\d\d|abort/i.test(detail) && failures >= 2) openMs = 5 * 60 * 1000;
  const state = openMs ? 'open' : 'closed';
  const value = { state, failures, reason: detail.slice(0, 120), openedAt: new Date().toISOString() };
  await cache.set(circuitKey(model), value, openMs || 15 * 60 * 1000, { namespace: 'pi-import-circuit' });
  return value;
}

export async function detectOpenRouterTier() {
  const key = 'pi-import:openrouter-tier';
  const cached = await cache.get(key, { namespace: 'pi-import-quota' });
  if (cached?.value) return cached.value;
  const apiKey = aiProviderEnvConfig.openrouterApiKey;
  if (!apiKey) return { valid: false, tier: 'local-only', ceiling: 0, checkedAt: new Date().toISOString() };
  let result;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    const qualified = response.ok && payload?.data?.is_free_tier === false;
    result = {
      valid: response.ok,
      tier: qualified ? 'qualified' : 'basic-free',
      ceiling: qualified ? 900 : 45,
      checkedAt: new Date().toISOString(),
    };
  } catch (_) {
    result = { valid: false, tier: 'unknown', ceiling: 45, checkedAt: new Date().toISOString() };
  }
  await cache.set(key, result, TIER_TTL, { namespace: 'pi-import-quota' });
  return result;
}

export async function readPIArtifactQuota(organizationId = 'delivera') {
  const [tier, entry] = await Promise.all([
    detectOpenRouterTier(),
    cache.get(quotaKey(organizationId), { namespace: 'pi-import-quota' }),
  ]);
  const used = Number(entry?.value?.used || 0);
  return {
    ...tier,
    used,
    remaining: Math.max(0, tier.ceiling - used),
    resetAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`,
  };
}

export async function reservePIArtifactCall(organizationId, { jobId, model, role } = {}) {
  const tier = await detectOpenRouterTier();
  if (!tier.valid || tier.ceiling <= 0) return { reserved: false, reason: 'local-only', ...tier };
  const circuit = await readPIArtifactCircuit(model);
  if (circuit.state === 'open') return { reserved: false, reason: 'model-circuit-open', circuit, ...tier };
  const lease = await cache.claimLease(quotaKey(organizationId), 5000, { namespace: 'pi-import-quota-lock' });
  if (!lease.acquired) return { reserved: false, reason: 'quota-busy', ...tier };
  try {
    const key = quotaKey(organizationId);
    const current = (await cache.get(key, { namespace: 'pi-import-quota' }))?.value || { used: 0, reservations: [] };
    if (current.used >= tier.ceiling) return { reserved: false, reason: 'daily-limit', ...tier, used: current.used };
    const reservation = { jobId, model, role, state: 'reserved', at: new Date().toISOString() };
    const next = { used: current.used + 1, reservations: [...current.reservations, reservation].slice(-1000) };
    await cache.set(key, next, DAY_TTL, { namespace: 'pi-import-quota' });
    return { reserved: true, used: next.used, remaining: tier.ceiling - next.used, ...tier };
  } finally {
    await cache.releaseLease(lease);
  }
}
