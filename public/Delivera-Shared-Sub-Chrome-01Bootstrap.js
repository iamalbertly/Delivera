/**
 * Global sub-chrome bootstrap — Brief queue / Gaps / PI pills on all non-Brief surfaces.
 */
import { mountGlobalAgentBar, updateGlobalAgentBar } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

function projectsFromStorage() {
  try {
    const csv = readSharedProjectsCsv().join(',');
    return csv || 'MPSA,MAS';
  } catch (_) {
    return 'MPSA,MAS';
  }
}

let bootstrapStarted = false;

function runBootstrapFetch() {
  if (bootstrapStarted) return;
  bootstrapStarted = true;
  bootstrapSubChromeFetch().catch(() => {});
}

export async function bootstrapSubChrome() {
  if (document.body?.classList?.contains('login-page')) return;
  if (document.body?.classList?.contains('governance-page')) return;
  if (document.body?.classList?.contains('settings-page')) return;
  mountGlobalAgentBar();
  if (bootstrapStarted) return;
  const defer = () => runBootstrapFetch();
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(defer, { timeout: 2500 });
  } else {
    setTimeout(defer, 1200);
  }
}

async function bootstrapSubChromeFetch() {
  try {
    const qs = `?projects=${encodeURIComponent(projectsFromStorage())}`;
    const [receiptRes, piRes] = await Promise.all([
      fetch(`/api/governance/worker-receipt.json${qs}`, { credentials: 'include' }),
      fetch(`/api/governance/pi-confidence.json${qs}`, { credentials: 'include' }),
    ]);
    if (!receiptRes.ok) return;
    const data = await receiptRes.json();
    let piConfidence = null;
    if (piRes.ok) {
      const piData = await piRes.json();
      piConfidence = piData.piConfidence;
    }
    const onSprint = document.body?.classList?.contains('current-sprint-page');
    updateGlobalAgentBar({
      meta: {
        workerReceipt: onSprint
          ? { ...data.workerReceipt, inboxTotal: 0 }
          : { ...data.workerReceipt, inboxTotal: data.inboxTotal },
        setupGaps: onSprint ? [] : (data.setupGaps || []),
        piConfidence: piConfidence || data.piConfidence || { headline: 'PI n/a' },
        sinceLastRun: onSprint ? null : (data.sinceLastRun || null),
        poReadiness: data.poReadiness || null,
      },
    });
  } catch (_) { /* non-blocking */ }
}
