/**
 * Injects feedback panel content into #feedback-panel so report.html stays under 300 lines.
 * Skipped when top chrome provides global Improve Delivera modal.
 */
import { getFeedbackPanelInnerHtml } from './Delivera-Report-Page-Feedback-Panel.js';

if (!document.body?.classList?.contains('has-top-chrome')) {
  const panel = document.getElementById('feedback-panel');
  if (panel) panel.innerHTML = getFeedbackPanelInnerHtml();
}
