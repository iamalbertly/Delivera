/**
 * Injects feedback panel content into #feedback-panel so report.html stays under 300 lines. Run before other report scripts.
 */
import { getFeedbackPanelInnerHtml } from './Reporting-App-Report-Page-Feedback-Panel.js';

const panel = document.getElementById('feedback-panel');
if (panel) panel.innerHTML = getFeedbackPanelInnerHtml();
