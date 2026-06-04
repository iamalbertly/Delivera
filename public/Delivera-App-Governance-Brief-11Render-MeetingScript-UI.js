import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { buildMeetingAnswerClipboard } from './Delivera-App-Governance-Brief-03Render-MeetingAnswer-UI.js';

export function renderMeetingScript(brief) {
  const n = brief?.leadershipNarrative || {};
  const script = n.meetingScript || [n.oneParagraph, n.whatToSay].filter(Boolean).join('\n\n');
  if (!script) return '';
  return `
    <details class="gov-meeting-script">
      <summary>${escapeHtml(COPY.meetingScript)}</summary>
      <div class="gov-meeting-script-body">
        <p>${escapeHtml(script).replace(/\n\n/g, '</p><p>')}</p>
      </div>
    </details>`;
}

export { buildMeetingAnswerClipboard };
