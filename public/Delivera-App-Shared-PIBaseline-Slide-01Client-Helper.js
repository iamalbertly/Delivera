import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { GOVERNANCE_QUARTER_KEY } from './Delivera-Shared-Storage-Keys.js';

export function readGovernanceQuarter() {
  try {
    return String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

async function artifactHash(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function pollImport(jobId, onProgress) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const job = await fetchJson(`/api/governance/pi-imports/${encodeURIComponent(jobId)}`, {
      signal: AbortSignal.timeout(15000),
    }, 'pi-artifact-progress');
    onProgress(job);
    if (job.state === 'awaiting-review' || job.state === 'approved') return { ...job.result, jobId: job.jobId };
    if (job.state === 'failed' || job.state === 'cancelled') {
      const error = new Error(job.terminalError?.error || job.message || 'Import did not complete.');
      error.body = job.terminalError;
      throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error('Processing exceeded ten minutes. The receipt is preserved; retry when the worker is available.');
}

/**
 * Native-first image, PDF, and PowerPoint import.
 * @param {{ file: File, projects: string[], projectsCsv?: string, squad?: string, onProgress?: Function }} opts
 */
export async function postSlidePropose({
  file, projects, projectsCsv = '', squad = '', onProgress = () => {},
}) {
  if (!file) throw new Error('Image, PDF, or PowerPoint file is required');
  const quarter = readGovernanceQuarter();
  const csv = projectsCsv || (projects || []).join(',');
  onProgress({ stage: 'hashing', message: 'Checking for a reusable verified result…', progress: 8 });
  const hash = await artifactHash(file);
  const prepared = await fetchJson('/api/governance/pi-imports/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hash,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      requestedSquad: squad,
      requestedQuarter: quarter,
    }),
  }, 'pi-artifact-prepare');
  if (prepared.status === 'cached') {
    onProgress({ stage: 'awaiting-review', message: 'Verified result reused. No AI call needed.', progress: 100 });
    return { ...prepared.result, cached: true, callsAvoided: prepared.callsAvoided };
  }
  if (prepared.status === 'joined') return pollImport(prepared.job.jobId, onProgress);

  const form = new FormData();
  form.append('artifact', file, file.name);
  form.append('artifactHash', hash);
  form.append('projects', csv);
  form.append('requestedSquad', squad);
  form.append('requestedQuarter', quarter);
  onProgress(prepared.job);
  const monitor = window.setInterval(() => {
    void fetchJson(`/api/governance/pi-imports/${encodeURIComponent(prepared.job.jobId)}`, {
      signal: AbortSignal.timeout(15000),
    }, 'pi-artifact-progress').then(onProgress).catch(() => {});
  }, 2000);
  try {
    const output = await fetchJson(prepared.uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prepared.uploadToken}` },
      body: form,
      signal: AbortSignal.timeout(10 * 60 * 1000),
    }, 'pi-artifact-upload');
    const result = output.result || output.job?.result;
    if (result) return { ...result, jobId: output.job?.jobId, cached: result.cacheStatus === 'exact-hit' };
    return pollImport(output.job?.jobId || prepared.job.jobId, onProgress);
  } finally {
    window.clearInterval(monitor);
  }
}
