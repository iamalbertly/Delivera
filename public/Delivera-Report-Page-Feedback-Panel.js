/**
 * Feedback panel inner HTML. Injected by Reporting-App-Report-Page-Feedback-Panel-Inject.js so report.html stays under 300 lines.
 */
export function getFeedbackPanelInnerHtml() {
  return (
    '<h2>Share Feedback</h2>' +
    '<p class="feedback-hint"><small>Your feedback helps improve clarity and trust in the reports.</small></p>' +
    '<label>Email (optional)<input type="email" id="feedback-email" placeholder="Optional (you@vodacom.co.tz)"></label>' +
    '<label>Feedback<textarea id="feedback-message" rows="4" placeholder="What is unclear, missing, or incorrect?"></textarea></label>' +
    '<div class="feedback-actions">' +
    '<button id="feedback-submit" class="btn btn-primary btn-compact">Send Feedback</button>' +
    '<button id="feedback-cancel" class="btn btn-secondary btn-compact">Cancel</button>' +
    '<div id="feedback-status" class="feedback-status"></div></div>'
  );
}
