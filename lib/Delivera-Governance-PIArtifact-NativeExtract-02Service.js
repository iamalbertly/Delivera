import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { PI_ARTIFACT_LIMITS, piImportError } from './Delivera-Governance-PIArtifact-Contracts-01SSOT.js';
import { detectFiscalPeriod, detectSquadsInText, sha256 } from './Delivera-Governance-PIArtifact-Identity-01SSOT.js';

const xml = new XMLParser({ ignoreAttributes: false, preserveOrder: false, trimValues: true });
const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const IRRELEVANT_RE = /\b(agenda|thank you|backup slides?|performance overview|capex execution|inventory|table of contents|delivered items)\b/i;

function requireWorkerForLargeArtifact(pageCount, label) {
  if (!process.env.VERCEL || process.env.PI_IMPORT_WORKER_URL || pageCount <= 10) return;
  throw piImportError(
    'PROCESSING_WORKER_REQUIRED',
    `${label} files above 10 pages require the secure processing worker.`,
    503,
    true,
    { label: 'Keep receipt and retry when the worker is available' },
  );
}

function collectText(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    const value = String(node).trim();
    if (value) out.push(value);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'a:t' || key.endsWith(':t')) collectText(value, out);
      else if (typeof value === 'object') collectText(value, out);
    }
  }
  return out;
}

function assertSafeZip(buffer) {
  let eocd = -1;
  for (let cursor = buffer.length - 22; cursor >= Math.max(0, buffer.length - 65557); cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === 0x06054b50) { eocd = cursor; break; }
  }
  if (eocd < 0) throw piImportError('PI_ARTIFACT_CORRUPT', 'This PowerPoint file is corrupt or unsupported.', 422);
  const expectedEntries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let entries = 0;
  let expanded = 0;
  while (entries < expectedEntries && offset <= buffer.length - 46) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw piImportError('PI_ARTIFACT_CORRUPT', 'This PowerPoint archive index is invalid.', 422);
    }
    entries += 1;
    if (buffer.readUInt16LE(offset + 8) & 0x1) {
      throw piImportError('PI_ARTIFACT_ENCRYPTED', 'Encrypted PowerPoint files are not supported.', 422);
    }
    expanded += buffer.readUInt32LE(offset + 24);
    if (entries > PI_ARTIFACT_LIMITS.maxArchiveEntries || expanded > PI_ARTIFACT_LIMITS.maxExpandedBytes) {
      throw piImportError('PI_ARTIFACT_ARCHIVE_LIMIT', 'This PowerPoint expands beyond the safe processing limit.', 422);
    }
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (!entries || entries !== expectedEntries) throw piImportError('PI_ARTIFACT_CORRUPT', 'This PowerPoint archive index is incomplete.', 422);
}

function classifyPage({ text = '', squads = [] } = {}) {
  const hasMonths = MONTH_RE.test(text);
  if (IRRELEVANT_RE.test(text)) return 'irrelevant';
  if (/waterfall delivery|m-pesa waterfall/i.test(text)) return 'waterfall-plan';
  const relevant = hasMonths && /\b(impact|business value)\b/i.test(text);
  if (relevant) return 'squad-commitments';
  if (squads.length > 0 && /delivery plan|timeline/i.test(text)) return 'squad-commitments';
  if (/performance|capex|overview/i.test(text)) return 'portfolio-context';
  return text.trim() ? 'portfolio-context' : 'image-only';
}

function deriveCommitments(page) {
  if (page.classification !== 'squad-commitments') return [];
  const lines = page.lines.map((line) => line.replace(/^[✓✔•▪■\-\s]+/, '').trim()).filter(Boolean);
  const sourceLines = page.lines.map((line) => String(line || '').trim()).filter(Boolean);
  const titled = [];
  let theme = '';
  for (let index = 0; index < sourceLines.length; index += 1) {
    const value = sourceLines[index].replace(/\s+/g, ' ').trim();
    if (/^(growth|customer|simplicity)$/i.test(value)) {
      theme = value;
      continue;
    }
    if (!/^[✓✔]$/.test(value)) continue;
    const parts = [];
    for (let cursor = index + 1; cursor < sourceLines.length; cursor += 1) {
      const next = sourceLines[cursor].replace(/\s+/g, ' ').trim();
      if (/^[•▪■✓✔]$/.test(next) || /^(growth|customer|simplicity|business value)$/i.test(next)) break;
      if (next && !MONTH_RE.test(next)) parts.push(next);
    }
    const title = parts.join(' ').replace(/\s+-\s+/g, '-').trim();
    if (title.length >= 8) titled.push({ title, theme });
  }
  if (titled.length) {
    return titled.slice(0, 12).map(({ title, theme: itemTheme }, ordinal) => ({
      candidateId: `${page.number}-${ordinal}-${sha256(title).slice(0, 10)}`,
      originalText: title,
      title,
      month: '',
      theme: itemTheme,
      businessValue: '',
      squad: page.squads[0]?.key || '',
      confidence: 0.9,
      extractionMethod: page.method,
      sourceSpan: {
        page: page.number,
        rawText: title,
        method: page.method,
        extractorVersion: 'native-v1',
      },
    }));
  }
  const monthLines = new Set(lines.filter((line) => MONTH_RE.test(line)));
  return lines.filter((line) => {
    if (monthLines.has(line) || line.length < 8 || line.length > 220) return false;
    if (/^(growth|customer|simplicity|impact|business value|c2 general|c3 confidential|further together|july|august|september)$/i.test(line)) return false;
    if (/^q[1-4]\s*(?:\||$)/i.test(line) || /^\d+(?:[.,]\d+)?%?$/.test(line)) return false;
    return !IRRELEVANT_RE.test(line);
  }).filter((line, index, all) => all.indexOf(line) === index).slice(0, 20).map((text, ordinal) => ({
    candidateId: `${page.number}-${ordinal}-${sha256(text).slice(0, 10)}`,
    originalText: text,
    title: text,
    month: '',
    theme: '',
    businessValue: '',
    squad: page.squads[0]?.key || '',
    confidence: 0.82,
    extractionMethod: page.method,
    sourceSpan: {
      page: page.number,
      rawText: text,
      method: page.method,
      extractorVersion: 'native-v1',
    },
  }));
}

function normalizePages(pages, artifactHash) {
  const allText = pages.map((page) => page.text).join('\n');
  const period = detectFiscalPeriod(allText);
  const normalized = pages.map((page) => {
    const squads = detectSquadsInText(page.text);
    const row = { ...page, squads, classification: classifyPage({ text: page.text, squads }) };
    const commitments = deriveCommitments(row).map((item) => ({
      ...item,
      sourceSpan: { ...item.sourceSpan, artifactHash },
    }));
    return { ...row, commitments };
  });
  return {
    artifactHash,
    period,
    pages: normalized,
    squads: detectSquadsInText(allText),
    commitments: normalized.flatMap((page) => page.commitments),
    text: allText,
    needsVisualExtraction: normalized.some((page) => page.classification === 'image-only'),
    method: 'native',
  };
}

export function buildVisualExtraction(text, artifactHash, {
  filename = 'Uploaded image',
  method = 'local-ocr',
  confidence = 0.7,
} = {}) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const page = {
    number: 1,
    title: lines[0] || filename,
    lines,
    text: lines.join('\n'),
    method,
    contentHash: sha256(lines.join('\n')),
  };
  const result = normalizePages([page], artifactHash);
  result.commitments = result.commitments.map((item) => ({ ...item, confidence: Math.min(item.confidence, confidence) }));
  result.pages[0].commitments = result.commitments;
  result.needsVisualExtraction = !lines.length;
  result.method = method;
  return result;
}

export async function extractPptx(buffer, artifactHash) {
  assertSafeZip(buffer);
  let archive;
  try { archive = unzipSync(new Uint8Array(buffer)); } catch (_) {
    throw piImportError('PI_ARTIFACT_CORRUPT', 'This PowerPoint file is corrupt or encrypted.', 422);
  }
  const names = Object.keys(archive);
  if (names.length > PI_ARTIFACT_LIMITS.maxArchiveEntries) {
    throw piImportError('PI_ARTIFACT_ARCHIVE_LIMIT', 'This PowerPoint contains too many internal files.', 422);
  }
  const expanded = names.reduce((total, name) => total + archive[name].byteLength, 0);
  if (expanded > PI_ARTIFACT_LIMITS.maxExpandedBytes) {
    throw piImportError('PI_ARTIFACT_ARCHIVE_LIMIT', 'This PowerPoint expands beyond the safe processing limit.', 422);
  }
  const slideNames = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (slideNames.length > PI_ARTIFACT_LIMITS.maxPages) {
    throw piImportError('PI_ARTIFACT_PAGE_LIMIT', `PowerPoint files are limited to ${PI_ARTIFACT_LIMITS.maxPages} slides.`, 422);
  }
  requireWorkerForLargeArtifact(slideNames.length, 'PowerPoint');
  const pages = slideNames.map((name, index) => {
    const parsed = xml.parse(strFromU8(archive[name]));
    const lines = collectText(parsed).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const text = lines.join('\n');
    return { number: index + 1, title: lines[0] || `Slide ${index + 1}`, lines, text, method: 'pptx-native', contentHash: sha256(text) };
  });
  return normalizePages(pages, artifactHash);
}

export async function extractPdf(buffer, artifactHash) {
  let document;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  } catch (_) {
    throw piImportError('PI_ARTIFACT_CORRUPT', 'This PDF is corrupt, encrypted, or unsupported.', 422);
  }
  if (document.numPages > PI_ARTIFACT_LIMITS.maxPages) {
    throw piImportError('PI_ARTIFACT_PAGE_LIMIT', `PDF files are limited to ${PI_ARTIFACT_LIMITS.maxPages} pages.`, 422);
  }
  requireWorkerForLargeArtifact(document.numPages, 'PDF');
  const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
    const number = index + 1;
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const lines = content.items.map((item) => String(item.str || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const text = lines.join('\n');
    return { number, title: lines[0] || `Page ${number}`, lines, text, method: 'pdf-native', contentHash: sha256(text) };
  }));
  return normalizePages(pages, artifactHash);
}

export async function extractNativeArtifact(buffer, meta, artifactHash) {
  if (meta.kind === 'pptx') return extractPptx(buffer, artifactHash);
  if (meta.kind === 'pdf') return extractPdf(buffer, artifactHash);
  return {
    artifactHash,
    period: { label: '', confidence: 0 },
    pages: [{ number: 1, title: meta.filename, lines: [], text: '', method: 'image', classification: 'image-only', commitments: [], squads: [] }],
    squads: [],
    commitments: [],
    text: '',
    needsVisualExtraction: true,
    method: 'image',
  };
}
