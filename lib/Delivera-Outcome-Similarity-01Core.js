/**
 * SSOT for narrative / issue summary similarity (outcome draft + dedupe).
 * Used by routes/api.js and Delivera-Outcome-Draft-Builder.js — do not duplicate.
 */

export function tokenizeForSimilarity(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3),
  );
}

export function jaccardSimilarity(a, b) {
  const as = tokenizeForSimilarity(a);
  const bs = tokenizeForSimilarity(b);
  if (!as.size && !bs.size) return 1;
  if (!as.size || !bs.size) return 0;
  let intersection = 0;
  as.forEach((token) => {
    if (bs.has(token)) intersection += 1;
  });
  const union = new Set([...as, ...bs]).size || 1;
  return intersection / union;
}

/** Sørensen–Dice on bigrams for short titles */
export function diceCoefficientBigrams(a, b) {
  const sa = String(a || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sb = String(b || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!sa.length && !sb.length) return 1;
  if (!sa.length || !sb.length) return 0;
  if (sa === sb) return 1;
  const bigrams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i += 1) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) || 0) + 1);
    }
    return out;
  };
  const A = bigrams(sa);
  const B = bigrams(sb);
  let inter = 0;
  A.forEach((count, bg) => {
    if (B.has(bg)) inter += Math.min(count, B.get(bg));
  });
  return (2 * inter) / (sa.length - 1 + sb.length - 1 + 0.001);
}

export function combinedTextSimilarity(a, b) {
  return Math.max(jaccardSimilarity(a, b), diceCoefficientBigrams(a, b));
}
