/**
 * Risks & Insights Component
 * Consolidates blocker context, learnings, and risk notes into one actionable card.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
const INSIGHT_MAX_LEN = 1000;

function toLocalIsoMinute(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(date);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export function renderRisksAndInsights(data) {
  const notes = data.notes || { dependencies: [], learnings: [], updatedAt: null };
  const assumptions = data.assumptions || [];
  const scopeChanges = data.scopeChanges || [];

  const dependencies = notes.dependencies || [];
  const learnings = notes.learnings || [];
  const hasAssumptions = assumptions.length > 0;

  // Dependencies only - scope changes are already shown in the Work Risks table above
  const blockersText = [];
  if (dependencies.length > 0) {
    blockersText.push(...dependencies);
  }

  let html = '<div class="transparency-card risks-insights-card" id="risks-insights-card">';
  html += '<h2>Risks & Insights</h2>';

  html += '<div class="insights-tabs" role="tablist" aria-label="Sprint insights">';
  html += '<button class="insights-tab active" role="tab" aria-selected="true" data-tab="blockers" aria-controls="blockers-panel">Blockers<span class="insights-tab-badge">' + blockersText.length + '</span></button>';
  html += '<button class="insights-tab" role="tab" aria-selected="false" data-tab="learnings" aria-controls="learnings-panel">Learnings<span class="insights-tab-badge">' + learnings.length + '</span></button>';
  html += '<button class="insights-tab" role="tab" aria-selected="false" data-tab="assumptions" aria-controls="assumptions-panel">Risks<span class="insights-tab-badge">' + assumptions.length + '</span></button>';
  html += '</div>';

  html += '<div id="blockers-panel" class="insights-panel active" role="tabpanel" aria-labelledby="blockers-tab">';
  if (blockersText.length > 0) {
    html += '<div class="insights-content">';
    blockersText.forEach((item) => {
      html += '<div class="insight-item blocker-item">';
      html += '<span class="insight-icon" aria-hidden="true">!</span>';
      html += '<div class="insight-text">' + escapeHtml(item) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="insight-actions">';
    html += '<p class="insight-hint">Add recommended unblock actions:</p>';
    html += '<div class="insight-input-grid">';
    html += '<label class="insight-label" for="blockers-action-type">Action type</label>';
    html += '<select id="blockers-action-type" class="insight-action-type" aria-label="Action type"><option value="">- Action type -</option><option value="Escalate">Escalate</option><option value="Reassign">Reassign</option><option value="Defer">Defer</option><option value="Custom">Custom</option></select>';
    html += '<label class="insight-label" for="blockers-owner">Owner</label>';
    html += '<input id="blockers-owner" class="insight-inline-input" type="text" maxlength="80" placeholder="e.g., Scrum Master" />';
    html += '<label class="insight-label" for="blockers-effective-at">Action time</label>';
    html += '<input id="blockers-effective-at" class="insight-inline-input" type="datetime-local" value="' + toLocalIsoMinute() + '" />';
    html += '</div>';
    html += '<textarea id="blockers-mitigation" rows="4" maxlength="1000" placeholder="e.g., Escalate to architecture team, schedule review meeting" class="insight-input" aria-describedby="blockers-char-count"></textarea>';
    html += '<span id="blockers-char-count" class="insight-char-count" aria-live="polite">0 / 1000</span>';
    html += '</div>';
  } else {
    html += '<div class="insight-empty"><p>No blockers detected. Sprint is flowing well.</p></div>';
  }
  html += '</div>';

  html += '<div id="learnings-panel" class="insights-panel" role="tabpanel" aria-labelledby="learnings-tab">';
  if (learnings.length > 0) {
    html += '<div class="insights-content">';
    learnings.forEach((item) => {
      html += '<div class="insight-item learning-item">';
      html += '<span class="insight-icon" aria-hidden="true">i</span>';
      html += '<div class="insight-text">' + escapeHtml(item) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="insight-actions">';
    html += '<p class="insight-hint">Add new learnings:</p>';
    html += '<textarea id="learnings-new" rows="4" maxlength="1000" placeholder="e.g., API integration easier than expected" class="insight-input" aria-describedby="learnings-char-count"></textarea>';
    html += '<span id="learnings-char-count" class="insight-char-count" aria-live="polite">0 / 1000</span>';
    html += '</div>';
  } else {
    html += '<div class="insight-empty"><p>No learnings captured yet. Document discoveries and improvements.</p></div>';
  }
  html += '</div>';

  html += '<div id="assumptions-panel" class="insights-panel" role="tabpanel" aria-labelledby="assumptions-tab">';
  if (hasAssumptions) {
    html += '<div class="insights-content">';
    assumptions.forEach((item) => {
      html += '<div class="insight-item assumption-item">';
      html += '<span class="insight-icon" aria-hidden="true">!</span>';
      html += '<div class="insight-text">' + escapeHtml(item) + '</div>';
      html += '<span class="risk-level" title="Risk level: Assumed low">Low</span>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="insight-empty"><p>No assumptions documented. Consider what could go wrong.</p></div>';
  }
  html += '<div class="insight-actions">';
  html += '<p class="insight-hint">Add risks and mitigation strategies:</p>';
  html += '<textarea id="assumptions-new" rows="4" maxlength="1000" placeholder="e.g., Risk: Third-party API downtime. Mitigation: fallback caching" class="insight-input" aria-describedby="assumptions-char-count"></textarea>';
  html += '<span id="assumptions-char-count" class="insight-char-count" aria-live="polite">0 / 1000</span>';
  html += '</div>';
  html += '</div>';

  html += '<div class="insights-actions-bar">';
  html += '<button id="insights-save" class="btn btn-primary btn-compact" type="button">Save All Insights</button>';
  html += '<div id="insights-status" class="insights-status"></div>';
  const savedAgoText = notes.updatedAt
    ? (() => {
      const mins = Math.max(0, Math.floor((Date.now() - new Date(notes.updatedAt).getTime()) / 60000));
      return mins < 1 ? 'Just now' : (mins < 60 ? mins + 'm ago' : Math.floor(mins / 60) + 'h ago');
    })()
    : '';
  html += '<p class="insights-updated" id="insights-saved-ago"' + (savedAgoText ? '' : ' style="display: none;"') + '>Saved ' + (savedAgoText || 'just now') + '</p>';
  html += '</div>';

  html += '</div>';
  return html;
}

function wireCharCount(root, textAreaSelector, countSelector, maxLen) {
  const textArea = root.querySelector(textAreaSelector);
  const count = root.querySelector(countSelector);
  if (!textArea || !count) return;
  const updateCount = () => {
    const len = (textArea.value || '').length;
    count.textContent = len + ' / ' + maxLen;
  };
  textArea.addEventListener('input', updateCount);
  updateCount();
}

function setInsightsStatus(card, text, cssVarName) {
  const statusEl = card.querySelector('#insights-status');
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = cssVarName ? `var(${cssVarName})` : '';
}

/**
 * Wire Risks & Insights tab navigation and handlers
 */
export function wireRisksAndInsightsHandlers() {
  const card = document.querySelector('.risks-insights-card');
  if (!card) return;

  const tabs = card.querySelectorAll('.insights-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      card.querySelectorAll('.insights-tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      card.querySelectorAll('.insights-panel').forEach((p) => {
        p.classList.remove('active');
      });

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const tabName = tab.dataset.tab;
      const panel = card.querySelector('#' + tabName + '-panel');
      if (panel) panel.classList.add('active');
    });

    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextTab = tab.nextElementSibling;
        if (nextTab?.classList.contains('insights-tab')) {
          nextTab.click();
          nextTab.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevTab = tab.previousElementSibling;
        if (prevTab?.classList.contains('insights-tab')) {
          prevTab.click();
          prevTab.focus();
        }
      }
    });
  });

  wireCharCount(card, '#blockers-mitigation', '#blockers-char-count', INSIGHT_MAX_LEN);
  wireCharCount(card, '#learnings-new', '#learnings-char-count', INSIGHT_MAX_LEN);
  wireCharCount(card, '#assumptions-new', '#assumptions-char-count', INSIGHT_MAX_LEN);

  const saveBtn = card.querySelector('#insights-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const actionType = card.querySelector('#blockers-action-type')?.value || '';
      const blockersOwner = (card.querySelector('#blockers-owner')?.value || '').trim();
      const blockersEffectiveAt = card.querySelector('#blockers-effective-at')?.value || '';
      let blockersMitigation = (card.querySelector('#blockers-mitigation')?.value || '').slice(0, INSIGHT_MAX_LEN);
      if (actionType) blockersMitigation = '[' + actionType + '] ' + blockersMitigation;
      if (blockersOwner) blockersMitigation = '[Owner: ' + blockersOwner + '] ' + blockersMitigation;
      if (blockersEffectiveAt) {
        const normalized = new Date(blockersEffectiveAt);
        const actionStamp = Number.isNaN(normalized.getTime()) ? blockersEffectiveAt : normalized.toISOString();
        blockersMitigation = '[Action time: ' + actionStamp + '] ' + blockersMitigation;
      }
      const learningsNew = (card.querySelector('#learnings-new')?.value || '').slice(0, INSIGHT_MAX_LEN);
      const assumptionsNew = (card.querySelector('#assumptions-new')?.value || '').slice(0, INSIGHT_MAX_LEN);

      const hasAnyInput = [blockersMitigation, learningsNew, assumptionsNew].some((v) => String(v || '').trim().length > 0);
      if (!hasAnyInput) {
        setInsightsStatus(card, 'Add at least one insight before saving', '--warning');
        return;
      }

      const payload = {
        blockerMitigation: blockersMitigation,
        newLearning: learningsNew,
        newAssumption: assumptionsNew
      };

      try {
        saveBtn.disabled = true;
        const response = await fetch('/api/current-sprint/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          setInsightsStatus(card, 'Saved', '--accent');
          const savedAgoEl = card.querySelector('#insights-saved-ago');
          if (savedAgoEl) {
            savedAgoEl.textContent = 'Saved just now';
            savedAgoEl.style.display = 'block';
          }
          setTimeout(() => {
            setInsightsStatus(card, '', '');
          }, 3000);
        } else {
          throw new Error('Failed to save insights');
        }
      } catch (_err) {
        setInsightsStatus(card, 'Error saving', '--danger');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
}

/**
 * Export insights as markdown
 */
export function exportRisksInsightsAsMarkdown(data) {
  const notes = data.notes || { dependencies: [], learnings: [] };
  const assumptions = data.assumptions || [];

  let markdown = '# Risks & Insights\n\n';

  if (notes.dependencies && notes.dependencies.length > 0) {
    markdown += '## Blockers / Dependencies\n';
    notes.dependencies.forEach((dep) => {
      markdown += `- ${dep}\n`;
    });
    markdown += '\n';
  }

  if (notes.learnings && notes.learnings.length > 0) {
    markdown += '## Learnings\n';
    notes.learnings.forEach((learning) => {
      markdown += `- ${learning}\n`;
    });
    markdown += '\n';
  }

  if (assumptions.length > 0) {
    markdown += '## Assumptions & Risks\n';
    assumptions.forEach((assumption) => {
      markdown += `- ${assumption}\n`;
    });
    markdown += '\n';
  }

  return markdown;
}
