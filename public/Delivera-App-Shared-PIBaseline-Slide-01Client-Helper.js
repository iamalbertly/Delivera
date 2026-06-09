/**
 * Shared client path for PI plan slide → propose API.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { resizeImageFileToBase64 } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';
import { aiProviderRequestHeaders, hasAiProviderKey, readAiProviderPref } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { GOVERNANCE_QUARTER_KEY } from './Delivera-Shared-Storage-Keys.js';

export function readGovernanceQuarter() {
  try {
    return String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * @param {{ file: File, projects: string[], projectsCsv?: string }} opts
 */
export async function postSlidePropose({ file, projects, projectsCsv = '' }) {
  if (!file) throw new Error('Image file is required');
  if (!hasAiProviderKey()) throw new Error(COPY.aiKeyRequiredSlide);
  const pref = readAiProviderPref();
  if (pref.provider === 'gemini') {
    throw new Error('Slide reading needs OpenAI, Claude, or OpenRouter. Change provider in Settings.');
  }
  const { base64, mimeType } = await resizeImageFileToBase64(file);
  const quarter = readGovernanceQuarter();
  const csv = projectsCsv || (projects || []).join(',');
  return fetchJson('/api/governance/pi-baseline/propose-from-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiProviderRequestHeaders() },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType,
      projects,
      projectsCsv: csv,
      quarter,
    }),
  }, 'pi-baseline-slide');
}
