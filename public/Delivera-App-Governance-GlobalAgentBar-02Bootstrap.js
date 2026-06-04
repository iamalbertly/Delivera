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
    const res = await fetch(`/api/governance/worker-receipt.json?projects=${encodeURIComponent(projectsFromStorage())}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    updateGlobalAgentBar({
      meta: {
        workerReceipt: data.workerReceipt,
        setupGaps: data.setupGaps || [],
        piConfidence: { headline: data.workerReceipt?.line?.slice(0, 40) || 'Agent idle' },
      },
    });
  } catch (_) { /* non-blocking */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
