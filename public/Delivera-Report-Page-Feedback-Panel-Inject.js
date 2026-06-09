/**
 * Injects feedback panel content into #feedback-panel so report.html stays under 300 lines.
 * Skipped when top chrome provides global Improve Delivera modal.
 */
import { getFeedbackPanelInnerHtml } from './Delivera-Report-Page-Feedback-Panel.js';

function syncFeedbackPanelMount() {
  const panel = document.getElementById('feedback-panel');
  if (!panel) return;
  if (document.body?.classList?.contains('has-top-chrome')) {
    panel.innerHTML = '';
    panel.dataset.feedbackInjectSkipped = 'true';
    return;
  }
  if (panel.dataset.feedbackInjectSkipped === 'true') return;
  if (!panel.innerHTML.trim()) {
    panel.innerHTML = getFeedbackPanelInnerHtml();
  }
}

function scheduleFeedbackPanelMount() {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => syncFeedbackPanelMount());
  } else {
    setTimeout(syncFeedbackPanelMount, 0);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleFeedbackPanelMount);
  } else {
    scheduleFeedbackPanelMount();
  }
  window.addEventListener('app:top-chrome-rendered', syncFeedbackPanelMount);
}
