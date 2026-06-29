/**
 * Dev port guard — detect busy ports, auto-pick free port (3000–3010), or clear with --force.
 * Usage: node scripts/Delivera-Dev-Port-Guard-01Check.js [--force]
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import net from 'net';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT_FILE = join(root, '.delivera-dev-port');
const PORT_RANGE_START = 3001;
const PORT_RANGE_END = 3010;

dotenv.config({ path: join(root, '.env') });

const preferredPort = Number(process.env.PORT) || PORT_RANGE_START;
const force = process.argv.includes('--force');
const portExplicit = Boolean(String(process.env.PORT || '').trim());

export function isPortInUse(targetPort) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', (err) => resolve(err?.code === 'EADDRINUSE'));
    probe.once('listening', () => {
      probe.close(() => resolve(false));
    });
    probe.listen(targetPort, '127.0.0.1');
  });
}

export async function findAvailablePort(start = PORT_RANGE_START, end = PORT_RANGE_END) {
  for (let p = start; p <= end; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const busy = await isPortInUse(p);
    if (!busy) return p;
  }
  return null;
}

function writeDevPortFile(port) {
  try {
    writeFileSync(PORT_FILE, String(port), 'utf8');
  } catch (_) { /* non-blocking */ }
}

function findPidsOnPort(targetPort) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      return Array.from(pids);
    } catch (_) {
      return [];
    }
  }

  try {
    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    return;
  }
  process.kill(Number(pid), 'SIGTERM');
}

async function resolvePort() {
  if (process.env.BASE_URL) {
    try {
      const parsed = new URL(process.env.BASE_URL);
      const port = parsed.port
        ? Number(parsed.port)
        : (parsed.protocol === 'https:' ? 443 : 80);
      process.env.PORT = String(port);
      writeDevPortFile(port);
      console.log(`[port-guard] Using BASE_URL port ${port} (skip scan)`);
      return port;
    } catch (_) { /* fall through */ }
  }
  if (process.env.SKIP_WEBSERVER === 'true' && process.env.PORT) {
    const locked = Number(process.env.PORT);
    if (Number.isFinite(locked) && locked > 0) {
      writeDevPortFile(locked);
      console.log(`[port-guard] SKIP_WEBSERVER — keeping PORT ${locked}`);
      return locked;
    }
  }

  const inUse = await isPortInUse(preferredPort);
  if (!inUse) {
    process.env.PORT = String(preferredPort);
    writeDevPortFile(preferredPort);
    console.log(`[port-guard] Port ${preferredPort} is free`);
    return preferredPort;
  }

  if (force) {
    const pids = findPidsOnPort(preferredPort);
    for (const pid of pids) {
      try {
        killPid(pid);
        console.log(`[port-guard] Terminated PID ${pid}`);
      } catch (error) {
        console.warn(`[port-guard] Failed to terminate PID ${pid}: ${error?.message || error}`);
      }
    }
    const stillBusy = await isPortInUse(preferredPort);
    if (!stillBusy) {
      process.env.PORT = String(preferredPort);
      writeDevPortFile(preferredPort);
      console.log(`[port-guard] Port ${preferredPort} is now free`);
      return preferredPort;
    }
  }

  const scanStart = portExplicit ? preferredPort : PORT_RANGE_START;
  const scanEnd = portExplicit ? Math.min(preferredPort + 10, PORT_RANGE_END + 10) : PORT_RANGE_END;
  const picked = await findAvailablePort(scanStart, scanEnd);
  if (picked == null) {
    console.error(`[port-guard] No free port in range ${scanStart}–${scanEnd}`);
    process.exit(1);
  }

  if (picked !== preferredPort) {
    console.warn(`[port-guard] Port ${preferredPort} is busy — using ${picked} instead`);
    console.warn(`[port-guard] Override: PORT=${picked} npm run dev:safe`);
  }
  process.env.PORT = String(picked);
  writeDevPortFile(picked);
  return picked;
}

async function main() {
  await resolvePort();
}

main().catch((error) => {
  console.error('[port-guard] Fatal:', error?.message || error);
  process.exit(1);
});
