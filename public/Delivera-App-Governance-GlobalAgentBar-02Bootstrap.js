/**
 * Lightweight global agent bar on settings/report surfaces.
 */
import { mountGlobalAgentBar, updateGlobalAgentBar } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';

function projectsFromStorage() {
  try {
    const csv = localStorage.getItem('delivera_selectedProjects') || 'MPSA,MAS';
    return csv.split(',').map((p) => p.trim()).filter(Boolean).join(',') || 'MPSA,MAS';
  } catch (_) {
    return 'MPSA,MAS';
  }
}

async function bootstrap() {
  mountGlobalAgentBar();
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
    updateGlobalAgentBar({
      meta: {
        workerReceipt: { ...data.workerReceipt, inboxTotal: data.inboxTotal },
        setupGaps: data.setupGaps || [],
        piConfidence: piConfidence || data.piConfidence || { headline: 'PI n/a' },
        sinceLastRun: data.sinceLastRun || null,
        poReadiness: data.poReadiness || null,
      },
    });
  } catch (_) { /* non-blocking */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
