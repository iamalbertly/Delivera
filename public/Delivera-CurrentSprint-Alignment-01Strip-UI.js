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
  let alignedTotal = 0;
  let offPiTotal = 0;
  let adHocTotal = 0;
  stories.forEach((s) => {
    const alignment = classifyWorkAlignment({ epicKey: s.epicKey, piBaselineCommittedKeys: baselineKeys });
    if (alignment.tier === 'pi') alignedTotal += 1;
    else if (alignment.tier === 'offPi') offPiTotal += 1;
    else if (alignment.tier === 'adHoc') adHocTotal += 1;
  });
  const rows = stories.slice(0, 3).map((s) => {
    const alignment = classifyWorkAlignment({ epicKey: s.epicKey, piBaselineCommittedKeys: baselineKeys });
    const key = s.issueKey || s.key || '';
    const fullTitle = String(s.summary || '').trim();
    const title = fullTitle.slice(0, 72);
    const titleAttr = fullTitle.length > title.length ? ` title="${escapeHtml(fullTitle)}"` : '';
    return `<li><a href="#story-row-${escapeHtml(key)}">${escapeHtml(key)}</a> <span class="sprint-alignment-title"${titleAttr}>${escapeHtml(title)}</span> ${renderAlignmentChip(alignment)}</li>`;
  }).join('');
  const misaligned = Math.max(0, stories.length - alignedTotal);
  const summaryDetail = [alignedTotal ? `${alignedTotal} PI` : '', offPiTotal ? `${offPiTotal} off-PI` : '', adHocTotal ? `${adHocTotal} ad-hoc` : ''].filter(Boolean).join(' · ');
  const studioChip = misaligned > 0
    ? `<a class="sprint-off-pi-chip verdict-pill" href="/governance?openAlignment=slide&amp;scope=SD" data-testid="sprint-open-alignment-studio">${misaligned} off-PI</a>`
    : '';
  return `
    <section class="sprint-alignment-strip" data-alignment-strip="1" data-testid="sprint-commitment-risk" aria-label="Work alignment">
      <div class="sprint-alignment-head">
        <strong>${alignedTotal} of ${stories.length}</strong> ${escapeHtml(COPY.alignmentSummary || 'aligned')}
        ${summaryDetail ? `<span>· ${escapeHtml(summaryDetail)}</span>` : ''}
        ${studioChip}
      </div>
      <ul class="sprint-alignment-list sprint-alignment-list--expanded">${rows}</ul>
    </section>`;
}

export function countAlignmentFromStories(stories = [], baselineKeys = []) {
  let offPi = 0;
  let adHoc = 0;
  let aligned = 0;
  stories.forEach((s) => {
    const alignment = classifyWorkAlignment({ epicKey: s.epicKey, piBaselineCommittedKeys: baselineKeys });
    if (alignment.tier === 'pi') aligned += 1;
    else if (alignment.tier === 'offPi') offPi += 1;
    else if (alignment.tier === 'adHoc') adHoc += 1;
  });
  return { aligned, offPi, adHoc, total: stories.length };
}

export async function mountAlignmentStrip(container, data) {
  if (!container || !data?.stories?.length) {
    if (container) container.innerHTML = '';
    return;
  }
  const projects = data?.meta?.projects || data?.board?.projectKeys?.join(',') || '';
  const keys = await loadBaselineKeys(projects);
  const counts = countAlignmentFromStories(data.stories, keys);
  data.meta = data.meta || {};
  data.meta.commitmentRisk = {
    offPi: counts.offPi,
    adHoc: counts.adHoc,
    aligned: counts.aligned,
    hasCommitmentRisk: counts.offPi > 0 || counts.adHoc > 0,
  };
  container.innerHTML = renderAlignmentStripHtml(data, keys);
}
