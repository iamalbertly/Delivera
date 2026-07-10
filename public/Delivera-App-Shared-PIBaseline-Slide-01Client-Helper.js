/**
 * Shared client path for PI plan slide → propose API.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { resizeImageFileToBase64 } from './Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js';
import { aiProviderRequestHeaders, readAiProviderPref } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { resolveEffectiveAiCapability } from './Delivera-AI-Readiness-01SSOT.js';
import { GOVERNANCE_QUARTER_KEY } from './Delivera-Shared-Storage-Keys.js';

export function readGovernanceQuarter() {
  try {
    return String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * @param {{ file: File, projects: string[], projectsCsv?: string, signal?: AbortSignal }} opts
 */
export async function postSlidePropose({ file, projects, projectsCsv = '', signal }) {
  if (!file) throw new Error('Image file is required');
  const capability = await resolveEffectiveAiCapability();
  if (!capability.slideVisionReady) {
    const err = new Error(COPY.aiKeyRequiredSlide);
    err.code = capability.reason === 'browser_test_required' ? 'BROWSER_TEST_REQUIRED' : 'AI_KEY_REQUIRED';
    throw err;
  }
  const pref = readAiProviderPref();
  if (pref.provider === 'gemini' && capability.source === 'browser') {
    throw new Error('Slide reading needs OpenAI, Claude, or OpenRouter. Change provider in Settings.');
  }
  const { base64, mimeType } = await resizeImageFileToBase64(file);
  const quarter = readGovernanceQuarter();
  const csv = projectsCsv || (projects || []).join(',');
  try {
    return await fetchJson('/api/governance/pi-baseline/propose-from-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiProviderRequestHeaders() },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        projects,
        projectsCsv: csv,
        quarter,
      }),
      ...(signal ? { signal } : {}),
    }, 'pi-baseline-slide');
  } catch (err) {
    if (err?.body?.code) {
      const wrapped = new Error(err.body.error || err.message);
      wrapped.code = err.body.code;
      throw wrapped;
    }
    throw err;
  }
}
