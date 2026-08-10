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

export function escapeAttr(value) {
  return escapeHtml(value);
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
 * Human-readable issue identity: linked key + spelled-out title (never bare Jira codes alone).
 * Prefers /report?issueKey= continuity; optional external Jira browse as secondary href.
 * @param {string} issueKey
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.href] - primary href (defaults to /report?issueKey=)
 * @param {string} [opts.jiraUrl] - external browse URL shown as title attribute / rel
 * @param {boolean} [opts.keyOnly] - when true, link the key but still require title in aria
 */
export function renderIssueIdentityHtml(issueKey, opts = {}) {
  const key = String(issueKey || '').trim();
  if (!key) return escapeHtml(opts.title || 'Unlinked');
  const title = String(opts.title || '').trim();
  const href = String(opts.href || `/report?issueKey=${encodeURIComponent(key)}`).trim();
  const jiraUrl = String(opts.jiraUrl || '').trim();
  const tip = jiraUrl || (title ? `${key} · ${title}` : key);
  const keyHtml = href
    ? `<a class="delivera-issue-key" href="${escapeHtml(href)}" data-issue-key="${escapeHtml(key)}" title="${escapeHtml(tip)}">${escapeHtml(key)}</a>`
    : `<span class="delivera-issue-key" data-issue-key="${escapeHtml(key)}">${escapeHtml(key)}</span>`;
  if (!title || opts.keyOnly) return keyHtml;
  return `<span class="delivera-issue-identity">${keyHtml} <span class="delivera-issue-title">${escapeHtml(title)}</span></span>`;
}

/**
 * Sprint identity: prefer name; always expose id in title; link to Current Sprint when squad known.
 */
export function renderSprintIdentityHtml(sprint = {}, opts = {}) {
  const id = String(sprint.id || opts.sprintId || '').trim();
  const name = String(sprint.name || opts.name || '').trim();
  const label = name || (id ? `Sprint ${id}` : 'Sprint');
  const href = String(opts.href || '').trim();
  const tip = [name, id ? `id ${id}` : ''].filter(Boolean).join(' · ');
  if (href) {
    return `<a class="delivera-sprint-identity" href="${escapeHtml(href)}" title="${escapeHtml(tip || label)}">${escapeHtml(label)}</a>`;
  }
  return `<span class="delivera-sprint-identity" title="${escapeHtml(tip || label)}">${escapeHtml(label)}</span>`;
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
