/**
 * Shared loading theater: rotating messages only (no progress bar).
 * Used by Current Sprint and Leadership for consistent "something is happening" feedback.
 * Report uses full theater (fill + messages + step cue) in Reporting-App-Report-Page-Loading-Steps.js.
 */

let rotatingIntervalId = null;

/**
 * Start rotating through messages in the given element every intervalMs.
 * @param {HTMLElement | null} messageEl - Element to update (e.g. .current-sprint-loading-msg)
 * @param {string[]} messages - Messages to rotate (e.g. ['Loading board…', 'Loading sprint…', 'Building view…'])
 * @param {number} [intervalMs=7000] - Rotation interval
 * @returns {() => void} Stop function (clears interval)
 */
export function startRotatingMessages(messageEl, messages, intervalMs = 7000) {
  stopRotatingMessages();
  if (!messageEl || !Array.isArray(messages) || messages.length === 0) return () => {};
  let index = 0;
  messageEl.textContent = messages[0];
  rotatingIntervalId = setInterval(() => {
    index = (index + 1) % messages.length;
    messageEl.textContent = messages[index];
  }, intervalMs);
  return stopRotatingMessages;
}

/**
 * Stop any rotating-message interval (e.g. when content or error is shown).
 */
export function stopRotatingMessages() {
  if (rotatingIntervalId != null) {
    clearInterval(rotatingIntervalId);
    rotatingIntervalId = null;
  }
}
