/**
 * "Your work" PI alignment strip on Current Sprint — one hop to Alignment Studio.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { classifyWorkAlignment, renderAlignmentChip } from './Delivera-Shared-WorkAlignment-01Chip-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

let cachedBaselineKeys = null;
let baselineFetchPromise = null;

async function loadBaselineKeys(projectsCsv) {
  if (cachedBaselineKeys) return cachedBaselineKeys;
  if (!baselineFetchPromise) {
    const pk = String(projectsCsv || '').split(',')[0] || '';
    baselineFetchPromise = fetch(`/api/governance/pi-baseline?projects=${encodeURIComponent(pk)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const keys = (data?.committedItems || []).map((i) => String(i.issueKey || '').toUpperCase()).filter(Boolean);
        cachedBaselineKeys = keys;
        return keys;
      })
      .catch(() => []);
  }
  return baselineFetchPromise;
}

export function renderAlignmentStripHtml(data, baselineKeys = []) {
  const stories = (Array.isArray(data?.stories) ? data.stories : []).slice(-5).reverse();
  if (!stories.length) return '';
  let aligned = 0;
  let piCount = 0;
  let offPiCount = 0;
  let adHocCount = 0;
  const rows = stories.map((s) => {
    const alignment = classifyWorkAlignment({ epicKey: s.epicKey, piBaselineCommittedKeys: baselineKeys });
    if (alignment.tier === 'pi') { aligned += 1; piCount += 1; }
    else if (alignment.tier === 'offPi') offPiCount += 1;
    else if (alignment.tier === 'adHoc') adHocCount += 1;
    const key = s.issueKey || s.key || '';
    return `<li><a href="#story-row-${escapeHtml(key)}">${escapeHtml(key)}</a> ${renderAlignmentChip(alignment)}</li>`;
  }).join('');
  const misaligned = Math.max(0, stories.length - aligned);
  const summaryDetail = [piCount ? `${piCount} PI` : '', offPiCount ? `${offPiCount} off-PI` : '', adHocCount ? `${adHocCount} ad-hoc` : ''].filter(Boolean).join(' · ');
  const studioChip = misaligned > 0
    ? `<a class="sprint-off-pi-chip verdict-pill" href="/governance?openAlignment=1" data-testid="sprint-open-alignment-studio">${misaligned} off-PI</a>`
    : '';
  return `
    <section class="sprint-alignment-strip" data-alignment-strip="1" aria-label="Work alignment">
      <div class="sprint-alignment-head">
        <strong>${aligned} of ${stories.length}</strong> ${escapeHtml(COPY.alignmentSummary || 'aligned')}
        ${summaryDetail ? `<span>· ${escapeHtml(summaryDetail)}</span>` : ''}
        ${studioChip}
      </div>
      <details open>
        <summary>Recent stories</summary>
        <ul class="sprint-alignment-list">${rows}</ul>
      </details>
    </section>`;
}

export async function mountAlignmentStrip(container, data) {
  if (!container || !data?.stories?.length) {
    if (container) container.innerHTML = '';
    return;
  }
  const projects = data?.meta?.projects || data?.board?.projectKeys?.join(',') || '';
  const keys = await loadBaselineKeys(projects);
  container.innerHTML = renderAlignmentStripHtml(data, keys);
}
