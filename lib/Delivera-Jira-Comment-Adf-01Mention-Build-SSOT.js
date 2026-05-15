/**
 * SSOT: plain text + @displayName → Jira ADF with mention nodes (Cloud accountId).
 */

function rosterByLongestName(roster = []) {
  return [...roster]
    .filter((p) => p?.displayName)
    .sort((a, b) => String(b.displayName).length - String(a.displayName).length);
}

function matchMentionAt(text, startIndex, roster) {
  if (text[startIndex] !== '@') return null;
  const rest = text.slice(startIndex + 1);
  for (const person of rosterByLongestName(roster)) {
    const name = String(person.displayName || '').trim();
    if (!name) continue;
    if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
    const after = rest[name.length];
    if (after && !/[\s,.;!?\n\r([]/.test(after)) continue;
    if (!person.accountId) continue;
    return { person, length: 1 + name.length };
  }
  return null;
}

function inlineNodesForParagraph(text, roster) {
  const nodes = [];
  let i = 0;
  while (i < text.length) {
    const hit = matchMentionAt(text, i, roster);
    if (hit) {
      if (i > 0) {
        nodes.push({ type: 'text', text: text.slice(0, i) });
        text = text.slice(i);
        i = 0;
      }
      const { person, length } = hit;
      nodes.push({
        type: 'mention',
        attrs: {
          id: person.accountId,
          text: `@${person.displayName}`,
          accessLevel: '',
        },
      });
      text = text.slice(length);
      i = 0;
      continue;
    }
    i += 1;
  }
  if (text) nodes.push({ type: 'text', text });
  return nodes.length ? nodes : [{ type: 'text', text: ' ' }];
}

/**
 * @param {string} text
 * @param {Array<{ accountId: string, displayName: string }>} [roster]
 */
export function buildAdfDocFromTextWithMentions(text, roster = []) {
  const raw = String(text || '').trim();
  const paragraphs = raw.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  const blocks = paragraphs.length ? paragraphs : [raw || ' '];
  const hasMentions = Array.isArray(roster) && roster.some((p) => p?.accountId);
  const content = blocks.map((para) => ({
    type: 'paragraph',
    content: hasMentions ? inlineNodesForParagraph(para, roster) : [{ type: 'text', text: para }],
  }));
  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Resolve @tokens in text to accountIds (longest displayName match).
 * @returns {string[]}
 */
export function extractMentionAccountIds(text, roster = []) {
  const ids = new Set();
  let i = 0;
  const raw = String(text || '');
  while (i < raw.length) {
    const hit = matchMentionAt(raw, i, roster);
    if (hit?.person?.accountId) {
      ids.add(hit.person.accountId);
      i += hit.length;
    } else {
      i += 1;
    }
  }
  return [...ids];
}
