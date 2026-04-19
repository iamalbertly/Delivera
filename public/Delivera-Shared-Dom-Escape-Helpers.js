export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }
  const str = String(value);
  return str.trim() === '' ? fallback : str;
}

/**
 * Returns HTML for an issue key: link if issueUrl present, else escaped text.
 * @param {string} issueKey - Key to display (e.g. MPSA-123)
 * @param {string} [issueUrl] - Full Jira browse URL; when present the key is rendered as a link
 * @returns {string} Safe HTML fragment
 */
export function renderIssueKeyLink(issueKey, issueUrl) {
  const label = (issueKey || '').trim() || '-';
  const escaped = escapeHtml(label);
  const url = (issueUrl || '').trim();
  if (url) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escaped + '</a>';
  }
  return escaped;
}

/**
 * Adds title attributes to elements that are visually truncated (overflowing) so users can hover to see full text.
 * @param {string} selector - CSS selector for cells to check (th, td)
 */
export function addTitleForTruncatedCells(selector) {
  try {
    const nodes = Array.from(document.querySelectorAll(selector || ''));
    nodes.forEach((n) => {
      if (!n || !n.isConnected) return;
      // Only set title if text is larger than container (horizontal overflow)
      if (n.scrollWidth > n.clientWidth && n.textContent && n.textContent.trim()) {
        n.setAttribute('title', n.textContent.trim());
      } else {
        // leave existing title if present, else remove
        if (!n.getAttribute('title')) n.removeAttribute('title');
      }
    });
  } catch (e) {
    // ignore errors on old browsers or hidden nodes
  }
} 
