export const PI_ARTIFACT_LIMITS = Object.freeze({
  imageBytes: 12 * 1024 * 1024,
  documentBytes: 50 * 1024 * 1024,
  maxPages: 100,
  maxArchiveEntries: 10000,
  maxExpandedBytes: 250 * 1024 * 1024,
  maxCallsPerArtifact: 3,
  providerTimeoutMs: 90000,
  jobTimeoutMs: 10 * 60 * 1000,
});

export const PI_IMPORT_STATES = Object.freeze([
  'accepted', 'hashing', 'extracting-native', 'classifying', 'local-ocr',
  'remote-ocr', 'verifying', 'matching-squad', 'matching-jira',
  'awaiting-review', 'approved', 'failed', 'cancelled',
]);

export const PI_IMPORT_PROGRESS = Object.freeze({
  accepted: 2,
  hashing: 8,
  'extracting-native': 22,
  classifying: 45,
  'local-ocr': 58,
  'remote-ocr': 70,
  verifying: 80,
  'matching-squad': 88,
  'matching-jira': 94,
  'awaiting-review': 100,
  approved: 100,
  failed: 100,
  cancelled: 100,
});

export function piImportError(code, message, httpStatus = 400, retryable = false, action = null) {
  const error = new Error(message);
  Object.assign(error, { code, httpStatus, retryable, action });
  return error;
}

export function validateArtifactMeta({ filename = '', mimeType = '', size = 0 } = {}) {
  const mime = String(mimeType).toLowerCase();
  const image = /^image\/(png|jpeg|webp)$/.test(mime);
  const pdf = mime === 'application/pdf';
  const pptx = mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (!image && !pdf && !pptx) {
    throw piImportError('PI_ARTIFACT_UNSUPPORTED', 'Upload a PNG, JPEG, WebP, PDF, or PowerPoint (.pptx) file.', 415);
  }
  const max = image ? PI_ARTIFACT_LIMITS.imageBytes : PI_ARTIFACT_LIMITS.documentBytes;
  if (Number(size) > max) {
    throw piImportError('PI_ARTIFACT_TOO_LARGE', `The file exceeds the ${Math.round(max / 1024 / 1024)} MB limit.`, 413);
  }
  return { filename: String(filename).slice(0, 240), mimeType: mime, size: Number(size) || 0, kind: image ? 'image' : pdf ? 'pdf' : 'pptx' };
}

export function safeImportFailure(error) {
  return {
    error: String(error?.message || 'PI artifact processing failed.'),
    code: String(error?.code || 'PI_IMPORT_FAILED'),
    retryable: error?.retryable === true,
    action: error?.action || { label: error?.retryable ? 'Retry import' : 'Choose another file' },
  };
}
