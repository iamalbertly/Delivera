/**
 * Single SSOT for JSON responses that must never double-send.
 * Prevents ERR_HTTP_HEADERS_SENT from becoming process-fatal noise.
 */

/**
 * @param {import('express').Response} res
 * @param {number} [status=200]
 * @param {object} body
 * @returns {boolean} true when sent, false when headers already flushed
 */
export function sendJsonOnce(res, status = 200, body = {}) {
  if (!res || res.headersSent || res.writableEnded) return false;
  try {
    res.status(Number(status) || 200).json(body);
    return true;
  } catch (err) {
    if (err?.code === 'ERR_HTTP_HEADERS_SENT' || /Cannot set headers after they are sent/i.test(String(err?.message || ''))) {
      return false;
    }
    throw err;
  }
}

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {object} body
 * @returns {boolean}
 */
export function sendErrorOnce(res, status, body) {
  return sendJsonOnce(res, status, body);
}
