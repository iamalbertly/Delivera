export function safeRiskLanguage({ consequenceConfidence = 'speculative', consequence = '', action = '' } = {}) {
  const normalized = String(consequenceConfidence || '').toLowerCase() === 'verified' ? 'verified' : 'speculative';
  if (normalized === 'verified') return `Protected delivery by acting on verified risk: ${action || consequence || 'intervention recorded'}`;
  return `Reduced exposure by acting early on a plausible risk: ${action || consequence || 'intervention recorded'}`;
}

