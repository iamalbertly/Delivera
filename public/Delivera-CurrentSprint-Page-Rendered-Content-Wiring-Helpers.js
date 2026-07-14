import { refreshNotificationDockFromStore } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Delivera-CurrentSprint-Notifications-Helpers.js';
import { showContent } from './Delivera-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage, renderCurrentSprintPageParts } from './Delivera-CurrentSprint-Render-Page.js';
import { mountAlignmentStrip } from './Delivera-CurrentSprint-Alignment-01Strip-UI.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import { rememberSurfaceHtml, clearInstantShell } from './Delivera-Shared-Instant-Shell-01UI.js';
import { renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import { getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { wireHeaderBarHandlers, relocateSprintScopeIntoHeaderBar } from './Delivera-CurrentSprint-Header-Bar.js';
import { wireDynamicHandlers } from './Delivera-CurrentSprint-Page-Handlers.js';
import { wireHealthDashboardHandlers } from './Delivera-CurrentSprint-Health-Dashboard.js';
import { wireRisksAndInsightsHandlers } from './Delivera-CurrentSprint-Risks-Insights.js';
import { wireSprintCarouselHandlers } from './Delivera-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Delivera-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Delivera-CurrentSprint-Render-Subtasks.js';
import { wireExportHandlers } from './Delivera-CurrentSprint-Export-Dashboard.js';
import { wireIssuePreviewHandlers } from './Delivera-CurrentSprint-Issue-Preview.js';
import { initJiraNudgeReviewSheetGlobal } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import { wireDecisionCockpitHandlers } from './Delivera-CurrentSprint-Decision-Cockpit.js';
import { scheduleRender } from './Delivera-Report-Page-Loading-Steps.js';
import { markPerf } from './Delivera-Shared-Perf-Marks.js';
import {
  deriveUseCaseFromRiskTags,
  getCurrentSprintPayload,
  getCurrentSprintSummaryContext,
  isSprintCommentSendAllowed,
  showSprintActionToast,
} from './Delivera-CurrentSprint-Action-Bridge.js';

function wireSprintProofRailHandlers() {
  const rail = document.getElementById('sprint-proof-rail');
  if (!rail || rail.dataset.railTabsBound === '1') return;
  rail.dataset.railTabsBound = '1';
  const activate = (tabId) => {
    rail.querySelectorAll('[data-rail-tab]').forEach((btn) => {
      const on = btn.getAttribute('data-rail-tab') === tabId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    rail.querySelectorAll('[data-rail-panel]').forEach((panel) => {
      const on = panel.getAttribute('data-rail-panel') === tabId;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  };
  rail.querySelectorAll('[data-rail-tab]').forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.getAttribute('data-rail-tab')));
  });
  const defaultTab = rail.getAttribute('data-default-rail-tab') || 'work';
  activate(defaultTab);
}

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

/**
 * ALB-84: include sprint HUD bar +, when scrolling within Mission-critical work, the sticky primary
 * controls strip (.stories-primary-sticky) so table/anchors land under the full sticky stack.
 */
function getStickyHeaderOffset(targetEl) {
  const header = document.querySelector('.current-sprint-header-bar');
  const navTop = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-global-nav-top') || '56') || 56;
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  let primaryStrip = 0;
  if (targetEl && typeof targetEl.closest === 'function' && targetEl.closest('#stories-card')) {
    const primary = document.querySelector('#stories-card .stories-primary-sticky');
    if (primary) {
      const pos = getComputedStyle(primary).position;
      if (pos === 'sticky' || pos === '-webkit-sticky') {
        primaryStrip = Math.ceil(primary.getBoundingClientRect().height);
      }
    }
  }
  return Math.max(96, Math.ceil(navTop + headerHeight + primaryStrip + 12));
}

function scrollToCurrentSprintTarget(target) {
  if (!target) return;
  const stickyOffset = getStickyHeaderOffset(target);
  const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function applyInitialHashFocus() {
  try {
    let hash = window.location && window.location.hash ? window.location.hash : '';
    if (hash === '#work-risks') hash = '#stuck-card';
    if (hash && hash.startsWith('#')) {
      const target = document.querySelector(hash);
      if (target) {
        window.setTimeout(() => {
          scrollToCurrentSprintTarget(target);
        }, 60);
      }
      return;
    }
    const blockerCard = document.getElementById('stuck-card');
    const blockerCount = Number(document.querySelector('[data-blocker-count]')?.getAttribute('data-blocker-count') || 0);
    if (blockerCard && blockerCount > 0) {
      window.setTimeout(() => {
        scrollToCurrentSprintTarget(blockerCard);
      }, 120);
    }
  } catch (_) {}
}

function wireSectionLinks() {
  const nav = document.querySelector('.sprint-section-links');
  if (!nav || nav.dataset.wiredSectionLinks === '1') return;
  nav.dataset.wiredSectionLinks = '1';
  const trigger = nav.querySelector('.sprint-section-dropdown-trigger');
  const menu = document.getElementById('sprint-section-dropdown-menu');
  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.getAttribute('aria-hidden') !== 'true';
      menu.hidden = open;
      menu.setAttribute('aria-hidden', open ? 'true' : 'false');
      trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    document.addEventListener('click', () => {
      menu.hidden = true;
      menu.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  }
  const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;
  const targets = links
    .map((link) => ({ link, target: document.querySelector(link.getAttribute('href') || '') }))
    .filter((entry) => entry.target);
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        scrollToCurrentSprintTarget(target);
      }
      if (menu) {
        menu.hidden = true;
        menu.setAttribute('aria-hidden', 'true');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  const syncActiveLink = () => {
    let activeHref = '';
    targets.forEach((entry) => {
      const offset = getStickyHeaderOffset(entry.target);
      const top = entry.target.getBoundingClientRect().top;
      if (top - offset <= 0) activeHref = entry.link.getAttribute('href') || activeHref;
    });
    targets.forEach((entry) => entry.link.classList.toggle('is-active', (entry.link.getAttribute('href') || '') === activeHref));
  };
  syncActiveLink();
  window.addEventListener('scroll', syncActiveLink, { passive: true });
}

function wireAttentionQueueHandlers() {
  document.querySelectorAll('[data-attention-action]').forEach((button) => {
    if (button.dataset.attentionWired === '1') return;
    button.dataset.attentionWired = '1';
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-attention-action') || '';
      const riskTagMap = {
        'open-blockers': ['blocker'],
        'open-missing-estimate': ['missing-estimate'],
        'open-unassigned': ['unassigned'],
      };
      const tags = riskTagMap[action];
      if (tags) {
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
            detail: { riskTags: tags, source: action },
          }));
        } catch (_) {}
        scrollToCurrentSprintTarget(document.getElementById('stories-card'));
      }
    });
  });
}

function wireSummaryActionBridge() {
  if (window.__currentSprintSummaryActionBridgeBound) return;
  window.__currentSprintSummaryActionBridgeBound = true;
  const ribbon = document.getElementById('current-sprint-ribbon');
  if (!ribbon) return;

  function renderRibbonFromContext(context) {
    if (!context) return;
    const action = String(context.topAction || context.next || '').trim();
    const headline = String(context.header || 'Summary copied').trim();
    const timeLeft = String(context.timeLeft || '').trim();
    const risks = String(context.risks || '').trim();
    if (!action && !headline && !timeLeft && !risks) return;
    const text = [
      headline,
      timeLeft ? `Time: ${timeLeft}` : '',
      risks,
      action ? `Do next: ${action}` : '',
    ].filter(Boolean).join(' | ');
    ribbon.textContent = text;
    ribbon.style.display = '';
    ribbon.setAttribute('data-state', 'fresh');
  }

  window.addEventListener('currentSprint:summaryCopied', (event) => {
    const context = event?.detail?.context || getCurrentSprintSummaryContext();
    renderRibbonFromContext(context);
  });

  const cached = getCurrentSprintSummaryContext();
  if (cached) renderRibbonFromContext(cached);
}

function wireNoClickJourneys() {
  if (window.__currentSprintNoClickJourneysBound) return;
  window.__currentSprintNoClickJourneysBound = true;

  function focusTopRiskRow(options = {}) {
    const applyFilter = options.applyFilter !== false;
    const shouldScroll = options.scroll !== false;
    try {
      const payload = window.__deliveraCurrentSprintPayload;
      const counts = payload ? getUnifiedRiskCounts(payload) : {};
      const scopeCount = Array.isArray(payload?.scopeChanges) ? payload.scopeChanges.length : 0;
      const stuck = Array.isArray(payload?.stuckCandidates) ? payload.stuckCandidates : [];
      const blockers = Number(counts.blockersOwned || counts.blockers || 0);
      const unowned = Number(counts.unownedOutcomes || 0);
      let riskTag = '';
      if (stuck.length > 0) riskTag = 'blocker';
      else if (scopeCount > 0) riskTag = 'scope';
      else if (blockers > 0) riskTag = 'blocker';
      else if (unowned > 0) riskTag = 'unassigned';
      if (applyFilter && riskTag) {
        const autoKey = 'delivera.sprint.autoBlocker.v1';
        const alreadyFiltered = sessionStorage.getItem(autoKey) === '1';
        if (!alreadyFiltered) {
          sessionStorage.setItem(autoKey, '1');
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
            detail: { riskTags: [riskTag], source: 'auto-blocker' },
          }));
        }
      }
      const row = document.querySelector(
        riskTag
          ? `#work-risks-table tbody tr[data-risk-tags*="${riskTag}"], #stories-table tbody tr[data-risk-tags*="${riskTag}"]`
          : '#work-risks-table tbody tr[data-risk-tags], #stories-table tbody tr[data-risk-tags]',
      );
      if (!row) return;
      row.classList.add('issue-preview-source-row');
      if (!shouldScroll) return;
      if (typeof window.currentSprintScrollToTarget === 'function') {
        window.currentSprintScrollToTarget(row);
      } else {
        row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}
  }

  function highlightTopBlockerRow() {
    try {
      const alreadyDone = sessionStorage.getItem('delivera.currentSprint.topBlockerHighlight.v1') === '1';
      if (alreadyDone) return;
      sessionStorage.setItem('delivera.currentSprint.topBlockerHighlight.v1', '1');
      focusTopRiskRow({ applyFilter: true, scroll: false });
    } catch (_) {}
  }

  function wireMissionBriefingClicks() {
    if (window.__currentSprintMissionBriefingBound) return;
    window.__currentSprintMissionBriefingBound = true;
    document.addEventListener('click', (event) => {
      const hit = event.target.closest('[data-mission-briefing-action="focus-top-risk"]');
      if (!hit) return;
      event.preventDefault();
      focusTopRiskRow({ applyFilter: true });
    });
  }

  function wireKeyboardShortcuts() {
    if (window.__currentSprintKeyboardShortcutsBound) return;
    window.__currentSprintKeyboardShortcutsBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      if (event.key === 's' || event.key === 'S') {
        const copySummaryBtn = document.querySelector('.export-dashboard-btn.export-default-action');
        if (copySummaryBtn) {
          event.preventDefault();
          copySummaryBtn.click();
        }
      } else if (event.key === 'g' || event.key === 'G') {
        const quickNudgeBtn = document.querySelector('[data-send-top-nudge]');
        if (quickNudgeBtn) {
          event.preventDefault();
          quickNudgeBtn.click();
        }
      } else if (event.key === '/') {
        const filterInput = document.getElementById('issue-jump-input');
        if (filterInput) {
          event.preventDefault();
          filterInput.focus();
          filterInput.select?.();
        }
      }
    });
  }

  window.setTimeout(highlightTopBlockerRow, 260);
  wireMissionBriefingClicks();
  wireKeyboardShortcuts();
}

export function wireStoryRowNudgeHandlers() {
  const table = document.getElementById('stories-table');
  if (!table || table.dataset.nudgeWired === '1') return;
  table.dataset.nudgeWired = '1';
  table.addEventListener('click', (ev) => {
    if (ev.target.closest('a, button, .story-row-toggle')) return;
    const row = ev.target.closest('tr[data-story-nudge]');
    if (!row) return;
    const issueKey = row.getAttribute('data-story-nudge');
    if (!issueKey) return;
    openJiraNudgeReviewSheet({ issueKey, prefillContext: `Unblock ${issueKey} today.` });
  });
}

export function wireProgressShowMoreHandlers() {
  const storiesBtn = document.querySelector('.stories-show-more');
  if (storiesBtn && storiesBtn.dataset.wiredShowMore !== '1') {
    storiesBtn.dataset.wiredShowMore = '1';
    storiesBtn.addEventListener('click', () => {
      const tableTemplate = document.getElementById('stories-more-template');
      const mobileTemplate = document.getElementById('stories-mobile-more-template');
      const tbody = document.querySelector('#stories-table tbody');
      const mobileList = document.getElementById('stories-mobile-card-list');
      if (tableTemplate && tbody) {
        const frag = tableTemplate.content.cloneNode(true);
        tbody.appendChild(frag);
      }
      if (mobileTemplate && mobileList) {
        const frag = mobileTemplate.content.cloneNode(true);
        mobileList.appendChild(frag);
      }
      storiesBtn.remove();
    });
  }
}

export function wireDailyCompletionTimelineHandlers() {
  try {
    const card = document.getElementById('stories-card');
    if (!card) return;
    const timeline = card.querySelector('.daily-completion-timeline');
    const chips = timeline ? Array.from(timeline.querySelectorAll('.daily-timeline-chip')) : [];
    const tableBody = card.querySelector('#stories-table tbody');
    const mobileCardsList = card.querySelector('#stories-mobile-card-list');
    if (!tableBody && !mobileCardsList) return;
    function getRows() {
      return tableBody ? Array.from(tableBody.querySelectorAll('tr')) : [];
    }
    function getMobileCards() {
      return mobileCardsList ? Array.from(mobileCardsList.querySelectorAll('.story-mobile-card')) : [];
    }
    const expandedStateKey = 'current_sprint_expanded_story_rows';
    const dayFilterStateKey = 'current_sprint_stories_day_filter';
    const storyFilterState = { activeRiskTags: [] };
    let expandedParents = new Set();
    try {
      const parsed = JSON.parse(window.localStorage.getItem(expandedStateKey) || '[]');
      if (Array.isArray(parsed)) expandedParents = new Set(parsed.map((v) => String(v || '').toUpperCase()).filter(Boolean));
    } catch (_) {}

    function persistExpandedState() {
      try {
        window.localStorage.setItem(expandedStateKey, JSON.stringify(Array.from(expandedParents)));
      } catch (_) {}
    }

    function getStoryRows() {
      return Array.from(tableBody.querySelectorAll('tr.story-parent-row'));
    }

    function syncParentChildren(parentRow) {
      if (!parentRow) return;
      const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
      if (!parentKey) return;
      const expanded = parentRow.getAttribute('aria-expanded') === 'true';
      const toggle = parentRow.querySelector('.story-row-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.textContent = expanded ? 'v' : '>';
        toggle.setAttribute('aria-label', expanded ? 'Collapse subtasks' : 'Expand subtasks');
        toggle.title = expanded ? 'Hide subtasks' : 'Show subtasks';
      }
      if (tableBody) {
        const childRows = tableBody.querySelectorAll('tr.subtask-child-row[data-parent-key="' + parentKey + '"]');
        childRows.forEach((row) => {
          if (expanded) row.removeAttribute('hidden');
          else row.setAttribute('hidden', 'hidden');
        });
      }
      parentRow.classList.toggle('story-parent-row-expanded', expanded);
    }

    function initializeStoryHierarchy() {
      getStoryRows().forEach((parentRow) => {
        const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
        if (!parentRow.hasAttribute('data-has-children')) return;
        const shouldExpand = expandedParents.has(parentKey);
        parentRow.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
        syncParentChildren(parentRow);
      });
    }

    function initializeMobileCards() {
      getMobileCards().forEach((cardEl) => {
        const parentKey = String(cardEl.getAttribute('data-parent-key') || '').toUpperCase();
        const mainBtn = cardEl.querySelector('.story-mobile-main');
        const expandEl = cardEl.querySelector('.story-mobile-expand');
        const shouldExpand = expandedParents.has(parentKey);
        if (mainBtn) mainBtn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
        if (expandEl) expandEl.hidden = !shouldExpand;
        cardEl.classList.toggle('story-mobile-card-expanded', shouldExpand);
      });
    }

    function applyDayFilter(dayKey) {
      const keyNorm = (dayKey || '').trim();
      chips.forEach((chip) => {
        const chipKey = (chip.getAttribute('data-day-key') || '').trim();
        chip.classList.toggle('daily-timeline-chip-active', chipKey === keyNorm);
      });
      getRows().forEach((row) => {
        const rowKey = (row.getAttribute('data-completed-day') || '').trim();
        const show = !keyNorm || (rowKey && rowKey === keyNorm);
        row.style.display = show ? '' : 'none';
      });
      getMobileCards().forEach((cardEl) => {
        const rowKey = (cardEl.getAttribute('data-completed-day') || '').trim();
        const show = !keyNorm || (rowKey && rowKey === keyNorm);
        cardEl.style.display = show ? '' : 'none';
      });
      initializeStoryHierarchy();
      initializeMobileCards();
      try {
        window.localStorage.setItem(dayFilterStateKey, keyNorm);
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('currentSprint:storiesDayFilterChanged', { detail: { dayKey: keyNorm } }));
      } catch (_) {}
    }

    if (timeline && chips.length) {
      timeline.addEventListener('click', (event) => {
        const chip = event.target.closest('.daily-timeline-chip');
        if (!chip || !timeline.contains(chip)) return;
        const dayKey = chip.getAttribute('data-day-key') || '';
        applyDayFilter(dayKey);
        try {
          if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(card);
          else card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
      });
    }

    card.addEventListener('click', (event) => {
      const riskChip = event.target.closest('.stories-risk-chip, .subtask-chip[data-risk-tags]');
      if (riskChip && card.contains(riskChip)) {
        event.preventDefault();
        const tagsAttr = (riskChip.getAttribute('data-risk-tags') || '').trim();
        const riskTags = tagsAttr ? tagsAttr.split(/\s+/).filter(Boolean) : [];
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'stories-risk-bar' } }));
        } catch (_) {}
      }
    });

    card.addEventListener('click', (event) => {
      const quickNudge = event.target.closest('[data-action="send-top-nudge-to-jira"]');
      if (!quickNudge || !card.contains(quickNudge)) return;
      event.preventDefault();
      const candidateRows = getRows().filter((row) => {
        const style = window.getComputedStyle(row);
        return style.display !== 'none' && !row.hasAttribute('hidden') && row.classList.contains('story-parent-row');
      });
      const topRow = candidateRows.find((row) => {
        const tags = String(row.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
        return tags.length > 0;
      }) || candidateRows[0];
      if (!topRow) return;
      const key = (topRow.querySelector('a[href*="/browse/"]')?.textContent || '').trim();
      const summary = (topRow.querySelector('.story-summary-cell')?.textContent || '').trim();
      const status = (topRow.querySelector('.story-status-cell')?.textContent || '').trim();
      const url = topRow.querySelector('a[href*="/browse/"]')?.href || '';
      if (!key) return;
      const payload = getCurrentSprintPayload();
      const readOnly = quickNudge.disabled || !isSprintCommentSendAllowed(payload?.meta, payload?.sprint);
      if (readOnly) {
        showSprintActionToast('Snapshot mode — switch to Live to comment in Jira.', 'error');
      }
      const staleHours = Number(topRow.getAttribute('data-hours-in-status') || 0) || null;
      const riskTags = String(topRow.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
      openJiraNudgeReviewSheet({
        issueKey: key,
        issueSummary: summary,
        issueStatus: status,
        issueUrl: url,
        useCase: deriveUseCaseFromRiskTags(riskTags),
        staleHours,
        readOnly,
        meta: payload?.meta,
        sprint: payload?.sprint,
      });
    });

    card.addEventListener('click', (event) => {
      const toggle = event.target.closest('.story-row-toggle');
      if (!toggle || !card.contains(toggle) || toggle.classList.contains('story-row-toggle-placeholder')) return;
      const parentRow = toggle.closest('tr.story-parent-row');
      if (!parentRow) return;
      const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
      const next = parentRow.getAttribute('aria-expanded') !== 'true';
      parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (next) expandedParents.add(parentKey);
      else expandedParents.delete(parentKey);
      persistExpandedState();
      syncParentChildren(parentRow);
      initializeMobileCards();
    });

    card.addEventListener('click', (event) => {
      const mobileBtn = event.target.closest('.story-mobile-main');
      if (!mobileBtn || !card.contains(mobileBtn)) return;
      const cardEl = mobileBtn.closest('.story-mobile-card');
      if (!cardEl) return;
      const parentKey = String(cardEl.getAttribute('data-parent-key') || '').toUpperCase();
      const next = mobileBtn.getAttribute('aria-expanded') !== 'true';
      mobileBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
      const expandEl = cardEl.querySelector('.story-mobile-expand');
      if (expandEl) expandEl.hidden = !next;
      cardEl.classList.toggle('story-mobile-card-expanded', next);
      if (next) expandedParents.add(parentKey);
      else expandedParents.delete(parentKey);
      persistExpandedState();
      const parentRow = tableBody ? tableBody.querySelector('tr.story-parent-row[data-parent-key="' + parentKey + '"]') : null;
      if (parentRow) {
        parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
        syncParentChildren(parentRow);
      }
    });

    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const toggle = event.target.closest('.story-row-toggle');
      if (!toggle || !card.contains(toggle)) return;
      event.preventDefault();
      toggle.click();
    });

    try {
      window.addEventListener('currentSprint:focusStoriesEvidence', () => {
        card.classList.add('row-attention-pulse');
        window.setTimeout(() => card.classList.remove('row-attention-pulse'), 1200);
      });
    } catch (_) {}

    if (!window.__currentSprintStoriesRiskFilterBound) {
      window.__currentSprintStoriesRiskFilterBound = true;
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event && event.detail ? event.detail : {};
        const activeTags = Array.isArray(detail.riskTags)
          ? detail.riskTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
          : [];
        storyFilterState.activeRiskTags = activeTags;
        getRows().forEach((row) => {
          if (!activeTags.length) {
            row.removeAttribute('data-role-filter-hidden');
            row.style.opacity = '';
            return;
          }
          const tags = (row.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          row.toggleAttribute('data-role-filter-hidden', !matches);
          row.style.opacity = matches ? '' : '0.35';
        });
        getMobileCards().forEach((cardEl) => {
          if (!activeTags.length) {
            cardEl.removeAttribute('data-role-filter-hidden');
            cardEl.style.opacity = '';
            return;
          }
          const tags = (cardEl.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          cardEl.toggleAttribute('data-role-filter-hidden', !matches);
          cardEl.style.opacity = matches ? '' : '0.35';
        });
        initializeStoryHierarchy();
        initializeMobileCards();
      });
    }
    const storiesShowMore = card.querySelector('.stories-show-more');
    if (storiesShowMore) {
      storiesShowMore.addEventListener('click', () => {
        window.setTimeout(() => {
          initializeStoryHierarchy();
          try {
            window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: storyFilterState.activeRiskTags, source: 'stories-show-more' } }));
          } catch (_) {}
          const activeChip = chips.find((chip) => chip.classList.contains('daily-timeline-chip-active'));
          if (activeChip) applyDayFilter(activeChip.getAttribute('data-day-key') || '');
          else {
            try {
              const storedDay = window.localStorage.getItem(dayFilterStateKey) || '';
              if (storedDay) applyDayFilter(storedDay);
            } catch (_) {}
          }
        }, 0);
      });
    }
    try {
      const storedDay = window.localStorage.getItem(dayFilterStateKey) || '';
      if (storedDay && chips.some((chip) => (chip.getAttribute('data-day-key') || '') === storedDay)) {
        applyDayFilter(storedDay);
      }
    } catch (_) {}
    initializeStoryHierarchy();
    initializeMobileCards();
  } catch (_) {}
}

export function appendCurrentSprintLoginLink(errorEl) {
  if (!errorEl || errorEl.querySelector('a.nav-link')) return;
  const link = document.createElement('a');
  const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  link.href = '/?redirect=' + redirect;
  link.className = 'nav-link';
  link.textContent = 'Sign in';
  link.style.marginLeft = '8px';
  errorEl.appendChild(document.createTextNode(' '));
  errorEl.appendChild(link);
}

function wireRenderedContent(data, onSelectSprintById) {
  try {
    window.currentSprintScrollToTarget = scrollToCurrentSprintTarget;
    window.__deliveraCurrentSprintPayload = data;
    renderSidebarContextCard();
    window.dispatchEvent(new CustomEvent('delivera:currentSprintPayloadReady'));
  } catch (_) {}
  updateNotificationStore(data);
  refreshNotificationDockFromStore();
  wireDynamicHandlers(data);
  wireHeaderBarHandlers();
  wireHealthDashboardHandlers();
  wireRisksAndInsightsHandlers();
  wireCountdownTimerHandlers();
  wireSubtasksShowMoreHandlers();
  wireProgressShowMoreHandlers();
  wireStoryRowNudgeHandlers();
  wireDailyCompletionTimelineHandlers();
  wireSprintCarouselHandlers((sprintId) => onSelectSprintById(sprintId));
  wireExportHandlers(data);
  initJiraNudgeReviewSheetGlobal();
  wireIssuePreviewHandlers();
  wireDecisionCockpitHandlers();
  wireSummaryActionBridge();
  wireNoClickJourneys();
  wireAttentionQueueHandlers();
  wireSectionLinks();
  collapseMobileDetailsSections();
  applyInitialHashFocus();
  wireSprintProofRailHandlers();
  void mountAlignmentStrip(document.getElementById('sprint-alignment-strip-mount'), data);
  const handleBlockerNudge = (ev) => {
    const btn = ev.target.closest('[data-blocker-nudge]');
    if (!btn) return;
    const issueKey = btn.getAttribute('data-blocker-nudge') || '';
    if (!issueKey) return;
    const draftEl = document.querySelector('.sprint-proof-rail-nudge-draft');
    const inlineDraft = draftEl?.value?.trim() || '';
    const roster = data?.meta?.teamRoster || [];
    openJiraNudgeReviewSheet({
      issueKey,
      useCase: 'blocker',
      meta: { teamRoster: roster, governanceSend: false },
      sprint: data?.sprint,
      initialDraft: inlineDraft || `${issueKey}: blocked ${Math.round(Number(data?.stuckCandidates?.find((c) => c.issueKey === issueKey)?.hoursInStatus || 0))}h — can we unblock today?`,
    });
  };
  document.getElementById('sprint-proof-rail')?.addEventListener('click', handleBlockerNudge);
  document.getElementById('sprint-proof-rail')?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    const ta = ev.target.closest('#sprint-rail-nudge-draft');
    if (!ta) return;
    ev.preventDefault();
    const issueKey = document.querySelector('[data-primary-blocker-key]')?.getAttribute('data-primary-blocker-key') || '';
    if (!issueKey) return;
    const inlineDraft = ta.value?.trim() || '';
    openJiraNudgeReviewSheet({
      issueKey,
      useCase: 'blocker',
      meta: { teamRoster: data?.meta?.teamRoster || [], governanceSend: false },
      sprint: data?.sprint,
      initialDraft: inlineDraft,
    });
  });
  document.querySelector('.sprint-blockers-panel')?.addEventListener('click', handleBlockerNudge);
}

export function showCurrentSprintRenderedContent(data, onSelectSprintById, options = {}) {
  const useProgressive = options.progressive === true;
  const scopeLabel = Array.isArray(data?.board?.projectKeys) ? data.board.projectKeys[0] : '';
  if (!useProgressive) {
    showContent(renderCurrentSprintPage(data));
    clearInstantShell();
    const content = document.getElementById('current-sprint-content') || document.getElementById('main-content');
    if (content) rememberSurfaceHtml('current-sprint', content.innerHTML, { scopeLabel });
    wireRenderedContent(data, onSelectSprintById);
    markPerf('current-sprint', 'firstValueRendered', { firstValueSource: options.source || 'live' });
    markPerf('current-sprint', 'fullRenderComplete');
    return;
  }

  const parts = renderCurrentSprintPageParts(data);
  showContent(parts.initialHtml);
  clearInstantShell();
  const content = document.getElementById('current-sprint-content') || document.getElementById('main-content');
  if (content) rememberSurfaceHtml('current-sprint', content.innerHTML, { scopeLabel });
  requestAnimationFrame(() => {
    relocateSprintScopeIntoHeaderBar();
    wireHeaderBarHandlers();
  });
  markPerf('current-sprint', 'firstValueRendered', { firstValueSource: options.source || 'live' });

  if (!parts.hasDeferredSections) {
    wireRenderedContent(data, onSelectSprintById);
    markPerf('current-sprint', 'fullRenderComplete');
    return;
  }

  scheduleRender(() => {
    showContent(parts.fullHtml);
    wireRenderedContent(data, onSelectSprintById);
    const anchor = document.querySelector('.current-sprint-header-bar, .sprint-jump-rail');
    if (anchor && window.scrollY > 120) {
      scrollToCurrentSprintTarget(anchor);
    }
    markPerf('current-sprint', 'fullRenderComplete');
  });
}
