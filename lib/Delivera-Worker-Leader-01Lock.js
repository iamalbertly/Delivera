import { logger } from './Delivera-Server-Logging-Utility.js';
import { appEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { cache } from './cache.js';

const LOCK_KEY = 'delivera:worker-leader';
const LOCK_TTL_SEC = 30;
const HEARTBEAT_MS = 10_000;

let heartbeatTimer = null;
let followerRetryTimer = null;

function leaderLockEnabled() {
  return process.env.WORKER_LEADER_LOCK === '1' || Number(process.env.INSTANCE_COUNT) > 1;
}

async function tryAcquireOrRenew(instanceId) {
  await cache.ensureBackend();
  if (!cache.redisReady || !cache.redisClient) {
    logger.warn('Worker leader lock enabled but Redis unavailable; running workers on this instance');
    return { isLeader: true, reason: 'redis-unavailable' };
  }

  const client = cache.redisClient;
  const acquired = await client.set(LOCK_KEY, instanceId, { NX: true, EX: LOCK_TTL_SEC });
  if (acquired === 'OK') {
    return { isLeader: true, reason: 'acquired' };
  }

  const holder = await client.get(LOCK_KEY);
  if (holder === instanceId) {
    await client.expire(LOCK_KEY, LOCK_TTL_SEC);
    return { isLeader: true, reason: 'renewed' };
  }

  return { isLeader: false, reason: 'follower', leader: holder || null };
}

function stopTimers() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (followerRetryTimer) {
    clearInterval(followerRetryTimer);
    followerRetryTimer = null;
  }
}

/**
 * Elect a single worker leader across instances (Redis SET NX + TTL heartbeat).
 * @param {{ onBecomeLeader: () => void | Promise<void> }} options
 * @returns {Promise<{ isLeader: boolean, reason: string, leader?: string | null }>}
 */
export async function electWorkerLeader({ onBecomeLeader }) {
  const instanceId = appEnvConfig.instanceId;

  if (!leaderLockEnabled()) {
    await onBecomeLeader();
    return { isLeader: true, reason: 'lock-disabled' };
  }

  const initial = await tryAcquireOrRenew(instanceId);
  if (initial.isLeader) {
    logger.info('Worker leadership acquired', { instanceId, reason: initial.reason });
    await onBecomeLeader();
    heartbeatTimer = setInterval(() => {
      tryAcquireOrRenew(instanceId).catch((error) => {
        logger.warn('Worker leader heartbeat failed', { error: error?.message });
      });
    }, HEARTBEAT_MS);
    heartbeatTimer.unref?.();
    return initial;
  }

  logger.info('Worker leadership deferred — following another instance', {
    instanceId,
    leader: initial.leader,
  });

  followerRetryTimer = setInterval(async () => {
    try {
      const next = await tryAcquireOrRenew(instanceId);
      if (!next.isLeader) return;
      stopTimers();
      logger.info('Worker leadership promoted on follower', { instanceId, reason: next.reason });
      await onBecomeLeader();
      heartbeatTimer = setInterval(() => {
        tryAcquireOrRenew(instanceId).catch((error) => {
          logger.warn('Worker leader heartbeat failed', { error: error?.message });
        });
      }, HEARTBEAT_MS);
      heartbeatTimer.unref?.();
    } catch (error) {
      logger.warn('Worker leader promotion attempt failed', { error: error?.message });
    }
  }, HEARTBEAT_MS * 2);
  followerRetryTimer.unref?.();

  return initial;
}

export function releaseWorkerLeadership() {
  stopTimers();
}
