/**
 * PI baseline propose + confirm wizard (inline panel in scope bar).
 */
function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.anchor — scope bar mount
 * @param {() => string} opts.getProjectsCsv
 * @param {() => void} [opts.onSaved]
 */
export function mountPIBaselineWizard({ anchor, getProjectsCsv, onSaved }) {
  if (!anchor) return;

  let panel = null;

  function close() {
    if (panel) { panel.remove(); panel = null; }
  }

  async function open() {
    close();
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    panel = document.createElement('div');
    panel.className = 'gov-baseline-wizard';
    panel.innerHTML = '<p class="gov-inbox-hint">Loading PI candidates…</p>';
    anchor.appendChild(panel);

    let data = { method: 'manual', candidates: [], guidance: null };
    try {
      const res = await fetch(`/api/governance/pi-baseline/propose?projects=${encodeURIComponent(csv)}`);
      if (res.ok) data = await res.json();
    } catch (_) { /* manual fallback */ }

    const projects = csv.split(',').map((p) => p.trim()).filter(Boolean);
    const piName = projects.join('+') || 'MPSA+MAS';

    if (!data.candidates?.length) {
      panel.innerHTML = `
        <p class="gov-baseline-wizard-title">Set PI baseline</p>
        <p class="gov-inbox-hint">${escapeHtml(data.guidance || 'Add committed issue keys manually in Jira first, then retry.')}</p>
        <button type="button" class="btn btn-link btn-compact" data-baseline-close>Close</button>`;
      panel.querySelector('[data-baseline-close]')?.addEventListener('click', close);
      return;
    }

    const rows = data.candidates.map((c, i) => `
      <label class="gov-baseline-row">
        <input type="checkbox" checked data-candidate="${i}" />
        <span>${escapeHtml(c.issueKey)} — ${escapeHtml((c.title || '').slice(0, 60))}</span>
      </label>`).join('');

    panel.innerHTML = `
      <p class="gov-baseline-wizard-title">Confirm PI baseline (${data.candidates.length} candidates)</p>
      <p class="gov-inbox-hint">Method: ${escapeHtml(data.method)}. Uncheck items that are not PI commitments.</p>
      <div class="gov-baseline-list">${rows}</div>
      <div class="gov-baseline-actions">
        <button type="button" class="btn btn-primary btn-compact" id="gov-baseline-confirm">Confirm baseline</button>
        <button type="button" class="btn btn-link btn-compact" data-baseline-close>Cancel</button>
      </div>`;

    panel.querySelector('[data-baseline-close]')?.addEventListener('click', close);
    panel.querySelector('#gov-baseline-confirm')?.addEventListener('click', async () => {
      const checked = [...panel.querySelectorAll('[data-candidate]:checked')];
      const items = checked.map((el) => {
        const idx = Number(el.getAttribute('data-candidate'));
        const c = data.candidates[idx];
        return { issueKey: c.issueKey, title: c.title, squad: c.squad || projects[0] };
      });
      if (!items.length) return;
      const res = await fetch('/api/governance/pi-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piName,
          projects,
          source: data.method,
          committedItems: items,
          approvedBy: 'governance-wizard',
        }),
      });
      if (res.ok) {
        close();
        onSaved?.();
      }
    });
  }

  return { open, close };
}
