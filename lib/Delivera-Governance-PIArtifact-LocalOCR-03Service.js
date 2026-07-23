import { createWorker } from 'tesseract.js';
import { loadImage } from '@napi-rs/canvas';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { piImportError } from './Delivera-Governance-PIArtifact-Contracts-01SSOT.js';
import { sha256 } from './Delivera-Governance-PIArtifact-Identity-01SSOT.js';

const LOCAL_OCR_TIMEOUT_MS = 45000;

export async function validateImageDimensions(buffer) {
  try {
    const image = await loadImage(buffer);
    if (image.width * image.height > 30_000_000) {
      throw piImportError('PI_ARTIFACT_PIXEL_LIMIT', 'Images are limited to 30 megapixels.', 422);
    }
    return { width: image.width, height: image.height };
  } catch (error) {
    if (error?.code === 'PI_ARTIFACT_PIXEL_LIMIT') throw error;
    throw piImportError('PI_ARTIFACT_CORRUPT', 'This image is corrupt or unsupported.', 422);
  }
}

export function extractStructuredLocalCommitments(regions = [], artifactHash = '') {
  const values = String(regions.find((row) => row.name === 'business-value')?.text || '')
    .split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^business value$/i.test(line));
  return regions.filter((row) => /^column-/.test(row.name)).map((region, ordinal) => {
    const lines = String(region.text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const themeIndex = lines.findIndex((line) => /^(growth|customer|simplicity)$/i.test(line));
    const theme = themeIndex >= 0 ? lines[themeIndex].replace(/^\w/, (value) => value.toUpperCase()) : '';
    const titleParts = [];
    for (const line of lines.slice(Math.max(0, themeIndex + 1))) {
      if (/^[+•▪■=*«]/.test(line) && titleParts.length) break;
      const cleaned = line.replace(/^[+•▪■=*«\s]+/, '').trim();
      if (cleaned) titleParts.push(cleaned);
      if (titleParts.length >= 2) break;
    }
    const title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
    if (title.length < 8) return null;
    return {
      candidateId: `1-${ordinal}-${sha256(`${artifactHash}:${title}`).slice(0, 10)}`,
      originalText: title,
      title,
      month: ['July', 'August', 'September'][ordinal] || '',
      theme,
      businessValue: values[ordinal] || '',
      squad: '',
      confidence: Math.min(0.9, region.confidence || 0.7),
      extractionMethod: 'tesseract-local-region',
      sourceSpan: {
        artifactHash,
        page: 1,
        boundingBox: region.boundingBox,
        rawText: title,
        method: 'tesseract-local-region',
        extractorVersion: 'tesseract-v1',
      },
    };
  }).filter(Boolean);
}

export async function runLocalOcr(buffer, { enabled = process.env.DELIVERA_LOCAL_OCR_ENABLED !== 'false' } = {}) {
  if (!enabled) return { text: '', confidence: 0, method: 'local-ocr-disabled' };
  let worker;
  const timeout = new Promise((_, reject) => {
    const error = piImportError('LOCAL_OCR_TIMEOUT', 'Local OCR took too long; shared OCR can continue if available.', 504, true);
    setTimeout(() => reject(error), LOCAL_OCR_TIMEOUT_MS).unref?.();
  });
  try {
    const cachePath = process.env.DELIVERA_OCR_CACHE_PATH || join(tmpdir(), 'delivera-tesseract-cache');
    await mkdir(cachePath, { recursive: true });
    worker = await createWorker('eng', 1, {
      logger: () => {},
      cachePath,
    });
    const result = await Promise.race([worker.recognize(buffer), timeout]);
    const text = String(result?.data?.text || '').trim();
    const image = await loadImage(buffer);
    const regions = [];
    if (image.width / image.height >= 1.4) {
      const top = Math.round(image.height * 0.14);
      const bottom = Math.round(image.height * 0.76);
      const columnWidth = Math.floor(image.width / 3);
      const rectangles = [
        ['column-1', { left: 0, top, width: columnWidth, height: bottom - top }],
        ['column-2', { left: columnWidth, top, width: columnWidth, height: bottom - top }],
        ['column-3', { left: columnWidth * 2, top, width: image.width - columnWidth * 2, height: bottom - top }],
        ['business-value', { left: 0, top: bottom, width: image.width, height: image.height - bottom }],
      ];
      for (const [name, rectangle] of rectangles) {
        const region = await Promise.race([worker.recognize(buffer, { rectangle }), timeout]);
        regions.push({
          name,
          text: String(region?.data?.text || '').trim(),
          confidence: Math.max(0, Math.min(0.9, Number(region?.data?.confidence || 0) / 100)),
          boundingBox: rectangle,
        });
      }
    }
    const regionConfidence = regions.length
      ? regions.reduce((total, row) => total + row.confidence, 0) / regions.length
      : 0;
    const confidence = Math.max(0, Math.min(0.9, Math.max(Number(result?.data?.confidence || 0) / 100, regionConfidence)));
    return { text, regions, confidence, method: 'tesseract-local', rawConfidence: Number(result?.data?.confidence || 0) };
  } catch (error) {
    if (error?.code === 'LOCAL_OCR_TIMEOUT') throw error;
    return { text: '', confidence: 0, method: 'tesseract-local-failed', error: String(error?.message || 'Local OCR failed') };
  } finally {
    await worker?.terminate?.().catch(() => {});
  }
}
