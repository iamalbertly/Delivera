/**
 * Risks & Insights Component
 * Consolidates blocker context, learnings, and risk notes into one actionable card.
 */

import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
const INSIGHT_MAX_LEN = 1000;

function toLocalIsoMinute(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(date);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function buildOutcomePrefill(text, reasonLabel) {
  const narrative = String(text || '').trim();
  if (!narrative) return '';
  const keyMatch = narrative.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
  const issueKey = keyMatch && keyMatch[1] ? keyMatch[1].toUpperCase() : '';
  const parts = [];
  if (issueKey) parts.push('Goal: Address ' + issueKey + '.');
  parts.push('Risk: ' + narrative + '.');
  if (reasonLabel) parts.push('Why now: ' + reasonLabel + '.');
  parts.push('Acceptance criteria: outcome, owner, and next step are visible in Jira.');
  return parts.join(' ');
}

export function renderRisksAndInsights(data) {
  const notes = data.notes || { dependencies: [], learnings: [], updatedAt: null };
  const assumptions = data.assumptions || [];

  const dependencies = notes.dependencies || [];
  const blockersText = dependencies.length > 0 ? [...dependencies] : [];
  const learnings = notes.learnings || [];
  const riskCounts = getUnifiedRiskCounts(data);
  const ownedBlockerCount = Number(riskCounts.blockersOwned || 0);
  /** SSOT: same as work queue � never show 0 blockers in UI when signals say >0 */
  const blockerChipCount = Math.max(blockersText.length, ownedBlockerCount);
  const summaryItems = [
    ...blockersText.map((text) => ({ kind: 'Blocker', text })),
    ...assumptions.map((text) => ({ kind: 'Risk', text })),
    ...learnings.map((text) => ({ kind: 'Learning', text })),
  ];
  const topItems = summaryItems.slice(0, 1);
  const blockerNotesLabel = blockersText.length === 1 ? '1 note' : `${blockersText.length} notes`;
  const oneLineSummary = blockerChipCount > 0
    ? `${blockerChipCount} blocker${blockerChipCount === 1 ? '' : 's'} in sprint signals (queue SSOT)${blockersText.length > 0 ? ` � ${blockerNotesLabel} below` : ''}`
    : (assumptions.length > 0
      ? `${assumptions.length} active risk${assumptions.length === 1 ? '' : 's'} in this sprint (team notes)`
      : (learnings.length > 0
        ? `${learnings.length} learning${learnings.length === 1 ? '' : 's'} captured`
        : 'No active risks need immediate review'));

  let html = '<div class="transparency-card risks-insights-card" id="risks-insights-card">';
  html += '<h2>Risks & Insights</h2>';
  html += '<p class="insights-summary-copy">' + escapeHtml(oneLineSummary) + '</p>';
  html += '<div class="insights-summary-strip">';
  html += '<span class="insights-summary-chip" title="Blockers: sprint risk signals and work queue (same SSOT); count is max of signals and saved dependency notes.">' + blockerChipCount + ' blockers</span>';
  html += '<span class="insights-summary-chip" title="Risks: team-entered notes in this card (not the same as signal tags in the queue).">' + assumptions.length + ' risks</span>';
  html += '<span class="insights-summary-chip" title="Learnings: team notes captured below.">' + learnings.length + ' learnings</span>';
  html += '</div>';
  html += '<div class="insights-tabs" role="tablist" aria-label="Risks and insights views">';
  html += '<button type="button" class="insights-tab active" id="blockers-tab" role="tab" aria-selected="true" aria-controls="blockers-panel" tabindex="0">Blockers <span class="insights-tab-badge">' + blockerChipCount + '</span></button>';
  html += '<button type="button" class="insights-tab" id="learnings-tab" role="tab" aria-selected="false" aria-controls="learnings-panel" tabindex="-1">Learnings <span class="insights-tab-badge">' + learnings.length + '</span></button>';
  html += '<button type="button" class="insights-tab" id="assumptions-tab" role="tab" aria-selected="false" aria-controls="assumptions-panel" tabindex="-1">Assumptions <span class="insights-tab-badge">' + assumptions.length + '</span></button>';
  html += '</div>';
  html += '<div id="blockers-panel" class="insights-panel active" role="tabpanel" aria-labelledby="blockers-tab">';
  if (blockersText.length > 0) {
    blockersText.slice(0, 3).forEach((text) => {
      html += '<div class="insight-item blocker-item"><span class="insight-icon" aria-hidden="true">!</span><div class="insight-text">' + escapeHtml(text) + '</div></div>';
    });
  } else {
    html += '<div class="insight-empty"><p>' + escapeHtml(blockerChipCount > 0 ? blockerChipCount + ' blocker' + (blockerChipCount === 1 ? '' : 's') + ' detected in sprint signals. Review the work queue below.' : 'No blockers need immediate review.') + '</p></div>';
  }
  html += '</div>';
  html += '<div id="learnings-panel" class="insights-panel" role="tabpanel" aria-labelledby="learnings-tab">';
  if (learnings.length > 0) {
    learnings.slice(0, 3).forEach((text) => {
      html += '<div class="insight-item learning-item"><span class="insight-icon" aria-hidden="true">i</span><div class="insight-text">' + escapeHtml(text) + '</div></div>';
    });
  } else {
    html += '<div class="insight-empty"><p>No learnings captured yet.</p></div>';
  }
  html += '</div>';
  html += '<div id="assumptions-panel" class="insights-panel" role="tabpanel" aria-labelledby="assumptions-tab">';
  if (assumptions.length > 0) {
    assumptions.slice(0, 3).forEach((text) => {
      html += '<div class="insight-item assumption-item"><span class="insight-icon" aria-hidden="true">!</span><div class="insight-text">' + escapeHtml(text) + '</div></div>';
    });
  } else {
    html += '<div class="insight-empty"><p>No assumptions logged yet.</p></div>';
  }
  html += '</div>';
  if (topItems.length > 0) {
    html += '<div class="insights-summary-list">';
    topItems.forEach((item) => {
      const itemClass = item.kind === 'Blocker' ? 'blocker-item' : (item.kind === 'Learning' ? 'learning-item' : 'assumption-item');
      html += '<div class="insight-item ' + itemClass + '">';
      html += '<span class="insight-icon" aria-hidden="true">' + (item.kind === 'Learning' ? 'i' : '!') + '</span>';
      html += '<div class="insight-text"><strong>' + escapeHtml(item.kind) + ':</strong> ' + escapeHtml(item.text) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    const blockerMessage = ownedBlockerCount > 0
      ? ownedBlockerCount + ' blocker' + (ownedBlockerCount === 1 ? '' : 's') + ' detected in sprint risk signals. Review the work queue below.'
      : 'No blockers or documented risks need immediate review.';
    html += '<div class="insight-empty"><p>' + escapeHtml(blockerMessage) + '</p></div>';
  }

  html += '<details class="insights-manage-drawer" data-mobile-collapse="true">';
  html += '<summary class="btn btn-secondary btn-compact">Manage notes</summary>';
  html += '<div class="insights-manage-grid">';
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
  html += '<div class="insight-actions">';
  html += '<p class="insight-hint">Add new learnings:</p>';
  html += '<textarea id="learnings-new" rows="3" maxlength="1000" placeholder="e.g., API integration easier than expected" class="insight-input" aria-describedby="learnings-char-count"></textarea>';
  html += '<span id="learnings-char-count" class="insight-char-count" aria-live="polite">0 / 1000</span>';
  html += '</div>';
  html += '<div class="insight-actions">';
  html += '<p class="insight-hint">Add risks and mitigation strategies:</p>';
  html += '<textarea id="assumptions-new" rows="3" maxlength="1000" placeholder="e.g., Risk: Third-party API downtime. Mitigation: fallback caching" class="insight-input" aria-describedby="assumptions-char-count"></textarea>';
  html += '<span id="assumptions-char-count" class="insight-char-count" aria-live="polite">0 / 1000</span>';
  html += '</div>';
  html += '<div class="insights-actions-bar">';
  html += '<button id="insights-save" class="btn btn-primary btn-compact" type="button">Save All Insights</button>';
  html += '<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-context="Create an outcome from risks and insights for this sprint.">Create outcome</button>';
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
  html += '</details>';
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

  const tabs = Array.from(card.querySelectorAll('.insights-tab'));
  const panels = Array.from(card.querySelectorAll('.insights-panel'));
  const focusVisibleInsightTabByIndex = (index) => {
    const visibleTabs = Array.from(document.querySelectorAll('.insights-tab'))
      .filter((item) => !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length));
    if (!visibleTabs.length) return false;
    const boundedIndex = Math.max(0, Math.min(Number(index || 0), visibleTabs.length - 1));
    const target = visibleTabs[boundedIndex];
    if (!target) return false;
    target.focus();
    return document.activeElement === target;
  };
  const activateTab = (targetTab, shouldFocus = false) => {
    if (!targetTab) return;
    tabs.forEach((tab) => {
      const isActive = tab === targetTab;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === targetTab.getAttribute('aria-controls'));
    });
    if (shouldFocus) targetTab.focus();
  };
  if (!window.__deliveraInsightsKeyboardFallbackWired) {
    window.__deliveraInsightsKeyboardFallbackWired = true;
    window.__deliveraLastInsightsFocusIndex = 0;
    document.addEventListener('focusin', (event) => {
      const tab = event.target?.closest?.('.insights-tab');
      if (!tab) return;
      const visibleTabs = Array.from(document.querySelectorAll('.insights-tab'))
        .filter((item) => !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length));
      const index = visibleTabs.indexOf(tab);
      if (index >= 0) window.__deliveraLastInsightsFocusIndex = index;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const activeEl = document.activeElement;
      if (activeEl?.closest?.('.insights-tab')) return;
      if (activeEl && activeEl !== document.body && activeEl !== document.documentElement) return;
      const visibleTabs = Array.from(document.querySelectorAll('.insights-tab'))
        .filter((item) => !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length));
      if (visibleTabs.length < 2) return;
      const currentIndex = Math.max(0, Math.min(Number(window.__deliveraLastInsightsFocusIndex || 0), visibleTabs.length - 1));
      const nextIndex = event.key === 'ArrowRight'
        ? (currentIndex + 1) % visibleTabs.length
        : (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
      event.preventDefault();
      window.__deliveraLastInsightsFocusIndex = nextIndex;
      focusVisibleInsightTabByIndex(nextIndex);
    }, true);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab, false));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      window.__deliveraLastInsightsFocusIndex = nextIndex;
      activateTab(tabs[nextIndex], true);
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
