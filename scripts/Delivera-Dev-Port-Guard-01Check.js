/**
 * Dev port guard — detect (and optionally clear) stale listeners before starting the server.
 * Usage: node scripts/Delivera-Dev-Port-Guard-01Check.js [--force]
 */
import { execSync } from 'child_process';
import net from 'net';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const port = Number(process.env.PORT) || 3000;
const force = process.argv.includes('--force');

function isPortInUse(targetPort) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', (err) => resolve(err?.code === 'EADDRINUSE'));
    probe.once('listening', () => {
      probe.close(() => resolve(false));
    });
    probe.listen(targetPort, '127.0.0.1');
  });
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

async function main() {
  const inUse = await isPortInUse(port);
  if (!inUse) {
    console.log(`[port-guard] Port ${port} is free`);
    return;
  }

  const pids = findPidsOnPort(port);
  if (!pids.length) {
    console.warn(`[port-guard] Port ${port} appears busy but no listener PID was found`);
    if (!force) process.exit(1);
    return;
  }

  console.warn(`[port-guard] Port ${port} is in use by PID(s): ${pids.join(', ')}`);
  if (!force) {
    const hint = process.platform === 'win32'
      ? `taskkill /PID ${pids[0]} /F`
      : `kill ${pids[0]}`;
    console.warn(`[port-guard] Stop the process or run: npm run dev:safe -- --force`);
    console.warn(`[port-guard] Manual: ${hint}`);
    process.exit(1);
  }

  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`[port-guard] Terminated PID ${pid}`);
    } catch (error) {
      console.warn(`[port-guard] Failed to terminate PID ${pid}: ${error?.message || error}`);
    }
  }

  const stillBusy = await isPortInUse(port);
  if (stillBusy) {
    console.error(`[port-guard] Port ${port} is still busy after --force`);
    process.exit(1);
  }
  console.log(`[port-guard] Port ${port} is now free`);
}

main().catch((error) => {
  console.error('[port-guard] Fatal:', error?.message || error);
  process.exit(1);
});
