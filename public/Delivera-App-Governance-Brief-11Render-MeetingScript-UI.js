import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { buildMeetingAnswerClipboard } from './Delivera-App-Governance-Brief-03Render-MeetingAnswer-UI.js';

export function renderMeetingScript(brief, opts = {}) {
  const n = brief?.leadershipNarrative || {};
  const script = n.meetingScript || [n.oneParagraph, n.whatToSay].filter(Boolean).join('\n\n');
  if (!script) return '';
  const bodyHtml = `<div class="gov-meeting-script-body">
        <p>${escapeHtml(script).replace(/\n\n/g, '</p><p>')}</p>
      </div>`;
  if (opts.promoted) {
    return `
    <div class="gov-meeting-script gov-meeting-script--promoted" data-meeting-script-promoted="1">
      <p class="gov-meeting-script-label">${escapeHtml(COPY.meetingScript)}</p>
      ${bodyHtml}
    </div>`;
  }
  const openAttr = opts.openByDefault ? ' open' : '';
  return `
    <details class="gov-meeting-script"${openAttr}>
      <summary>${escapeHtml(COPY.meetingScript)}</summary>
      ${bodyHtml}
    </details>`;
}

export { buildMeetingAnswerClipboard };
