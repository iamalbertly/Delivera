/**
 * SSOT: PI focus intent strip — one primary verb + More overflow.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderCreateWorkButton } from './Delivera-App-Shared-CreateWork-01Button-Render-SSOT.js';
import { mergePiFocusWithCache } from './Delivera-App-Shared-PIBaseline-02Slide-Outcome-Bridge-SSOT.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

function headlineFor(piFocus = {}) {
  const key = piFocus.headlineKey || '';
  if (key && COPY[key]) return COPY[key];
  return COPY.piFocusNoBaseline;
}

function countsLine(piFocus = {}) {
  const matched = Number(piFocus.matchedCount) || 0;
  const missing = Number(piFocus.proposedMissing) || 0;
  const dup = Number(piFocus.duplicateRiskCount) || 0;
  const ai = piFocus.aiKnows || {};
  const method = ai.method || 'board';
  const extracted = ai.extractedCount || 0;
  const alignedHint = extracted
    ? ` · ${extracted} from slide (${method})`
    : ` · ${piFocus.boardEpicCount || 0} board epics (${method})`;
  if (missing || dup || matched) {
    return COPY.piFocusCounts
      .replace('{matched}', String(matched || piFocus.boardEpicCount || 0))
      .replace('{missing}', String(missing))
      .replace('{dup}', String(dup)) + alignedHint;
  }
  return COPY.baselineSlideEpicSummary
    .replace('{matched}', String(piFocus.boardEpicCount || 0))
    .replace('{missing}', String(missing)) + alignedHint;
}

function studioOpenBtn(label, testId, opts = {}) {
  const mode = opts.slide ? ' data-pi-focus-slide="1"' : ' data-setup-action="set-baseline" data-setup-baseline-ssot="1"';
  return `<button type="button" class="btn ${opts.primary ? 'btn-primary' : 'btn-secondary'} btn-compact"${mode} data-testid="${escapeHtml(testId)}">${escapeHtml(label)}</button>`;
}

export function renderPiFocusStrip(brief = {}) {
  const raw = brief?.meta?.piFocus || {};
  const piFocus = mergePiFocusWithCache(raw);
  if (piFocus.synergy !== 'low') return '';

  const projectsCsv = (brief?.projects || readSharedProjectsCsv()).join(',');
  const headline = headlineFor(piFocus);
  const counts = countsLine(piFocus);
  const narrative = piFocus.createWorkNarrative || '';

  const overflowItems = [
    `<button type="button" class="btn btn-link btn-compact" data-pi-focus-slide data-testid="gov-pi-focus-slide">${escapeHtml(COPY.piFocusUploadSlide)}</button>`,
  ];
  if (piFocus.primaryAction === 'create-work' || narrative) {
    overflowItems.push(renderCreateWorkButton({
      projectsCsv,
      prefill: narrative,
      label: COPY.baselineSlideCreateMissing,
      testId: 'gov-pi-focus-create-work',
      variant: 'btn-link btn-compact',
    }));
  }

  return `
    <section class="gov-pi-focus gov-pi-focus--compact" data-testid="gov-pi-focus-strip" aria-label="${escapeHtml(COPY.alignmentStudioTitle)}">
      <div class="gov-pi-focus-main">
        <p class="gov-pi-focus-headline">${escapeHtml(headline)}</p>
        <p class="gov-pi-focus-counts" data-testid="gov-pi-focus-counts">${escapeHtml(counts)}</p>
      </div>
      <div class="gov-pi-focus-actions">
        ${studioOpenBtn(COPY.piBaselineSetupLabel, 'gov-pi-focus-set-baseline', { primary: true })}
        <details class="gov-pi-focus-more">
          <summary class="btn btn-secondary btn-compact" data-testid="gov-pi-focus-more">${escapeHtml(COPY.piFocusMore)}</summary>
          <div class="gov-pi-focus-more-menu">${overflowItems.join('')}</div>
        </details>
      </div>
    </section>`;
}

export function bindPiFocusStrip(root, { openPiBaselineWizard } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-pi-focus-slide]').forEach((el) => {
    el.addEventListener('click', () => {
      openPiBaselineWizard?.({ initialMode: 'slide' });
    });
  });
}

export function mountPiFocusStrip(brief, mountEl, handlers = {}) {
  if (!mountEl) return;
  const parent = mountEl.parentElement;
  parent?.querySelector('[data-testid="gov-pi-focus-strip"]')?.remove();
  const html = renderPiFocusStrip(brief);
  if (!html) return;
  mountEl.insertAdjacentHTML('afterend', html);
  const strip = parent?.querySelector('[data-testid="gov-pi-focus-strip"]');
  bindPiFocusStrip(strip, handlers);
}
