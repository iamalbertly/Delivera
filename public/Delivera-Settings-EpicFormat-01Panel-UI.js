/**
 * Settings — org epic naming format (admin-editable).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function renderForm(data = {}) {
  const { format = {}, preview = '', editable = false } = data;
  const disabled = editable ? '' : ' disabled';
  return `
    <section class="surface-card settings-section-card" data-testid="settings-epic-format-panel">
      <h2 class="settings-section-title">${escapeHtml(COPY.epicFormatSettingsTitle)}</h2>
      <p class="gov-ai-helper-note">${escapeHtml(COPY.epicFormatSettingsHint)}</p>
      <form class="settings-epic-format-form" id="settings-epic-format-form">
        <label class="settings-field">
          <span>Title template</span>
          <input type="text" name="template" value="${escapeHtml(format.template || '')}" data-testid="settings-epic-format-template"${disabled} />
        </label>
        <label class="settings-field">
          <span>Default subsystem</span>
          <input type="text" name="defaultSubsystem" value="${escapeHtml(format.defaultSubsystem || 'NBA')}" data-testid="settings-epic-format-subsystem"${disabled} />
        </label>
        <p class="gov-ai-helper-note settings-epic-format-preview" data-testid="settings-epic-format-preview">
          <strong>Preview:</strong> ${escapeHtml(preview || '')}
        </p>
        ${editable
    ? `<button type="submit" class="btn btn-primary btn-compact" data-testid="settings-epic-format-save">${escapeHtml(COPY.epicFormatSettingsSave)}</button>`
    : `<p class="gov-ai-helper-note">${escapeHtml(COPY.epicFormatSettingsReadOnly)}</p>`}
        <p class="gov-inbox-hint">${escapeHtml(COPY.epicFormatSettingsApplies)}</p>
      </form>
    </section>`;
}

export function mountEpicFormatPanel(mount) {
  if (!mount) return;

  async function load() {
    mount.innerHTML = '<section class="surface-card settings-section-card"><p class="gov-ai-helper-note">Loading epic format…</p></section>';
    try {
      const res = await fetch('/api/settings/epic-format.json', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      mount.innerHTML = renderForm(data);
      const form = mount.querySelector('#settings-epic-format-form');
      form?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const body = {
          template: String(fd.get('template') || '').trim(),
          defaultSubsystem: String(fd.get('defaultSubsystem') || '').trim(),
        };
        const saveRes = await fetch('/api/settings/epic-format.json', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          alert(err?.error || 'Could not save epic format');
          return;
        }
        const saved = await saveRes.json();
        const preview = mount.querySelector('[data-testid="settings-epic-format-preview"]');
        if (preview) preview.innerHTML = `<strong>Preview:</strong> ${escapeHtml(saved.preview || '')}`;
      });
    } catch (err) {
      mount.innerHTML = `<section class="surface-card settings-section-card"><p class="gov-ai-helper-note">Could not load epic format: ${escapeHtml(err?.message || 'error')}</p></section>`;
    }
  }

  void load();
}
