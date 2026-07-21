/**
 * SSOT for safe, actionable vision-provider failures.
 * Raw provider messages remain server-side because they may contain key or account details.
 */
const ERROR_RULES = [
  {
    pattern: /monthly limit|key limit|quota|credit|billing|insufficient[_\s-]?funds|resource exhausted/i,
    code: 'AI_PROVIDER_LIMIT_REACHED',
    httpStatus: 429,
    message: 'Slide reading is unavailable because the AI usage limit was reached. Update the AI provider in Settings or retry after the limit resets.',
  },
  {
    pattern: /unauthori[sz]ed|invalid.*(?:key|token)|authentication|api key.*(?:invalid|expired)/i,
    code: 'AI_PROVIDER_AUTH_FAILED',
    httpStatus: 503,
    message: 'Slide reading could not authenticate with the AI provider. Check the provider in Settings, then retry.',
  },
  {
    pattern: /timeout|timed out|abort/i,
    code: 'AI_PROVIDER_TIMEOUT',
    httpStatus: 504,
    message: 'Slide reading took too long. Your file was not saved. Retry the upload.',
  },
];

export function classifyVisionProviderError(rawError = '') {
  const detail = String(rawError || '').trim();
  const match = ERROR_RULES.find((rule) => rule.pattern.test(detail));
  return match
    ? { code: match.code, httpStatus: match.httpStatus, message: match.message, retryable: true }
    : {
        code: 'AI_VISION_UNAVAILABLE',
        httpStatus: 503,
        message: 'Slide reading is temporarily unavailable. Your file was not saved. Retry or check the AI provider in Settings.',
        retryable: true,
      };
}

export function visionProviderError(rawError = '') {
  const failure = classifyVisionProviderError(rawError);
  const error = new Error(failure.message);
  Object.assign(error, failure, { providerDetail: String(rawError || '').trim() });
  return error;
}

export function emptyVisionResultError() {
  const error = new Error('No readable commitments were found in this image. Try a clearer PNG or JPEG that includes the squad plan text.');
  Object.assign(error, {
    code: 'AI_SLIDE_CONTENT_NOT_FOUND',
    httpStatus: 422,
    retryable: true,
    providerDetail: 'Provider returned a valid response without commitments.',
  });
  return error;
}
