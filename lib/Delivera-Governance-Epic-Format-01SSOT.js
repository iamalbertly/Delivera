/**
 * SSOT: Org epic naming format — FY## Q# – system – subsystem – capability.
 */
export const EPIC_DELIM = ' – ';

export const DEFAULT_EPIC_FORMAT = Object.freeze({
  template: '{quarter} – {system} – {subsystem} – {capability}',
  delimiter: EPIC_DELIM,
  defaultSubsystem: 'NBA',
  squadSystemMap: Object.freeze({
    DMS: 'DMS',
    SD: 'DMS',
    MPSA: 'MPSA',
    MAS: 'MAS',
  }),
  squadOverrides: Object.freeze({}),
});

export function normalizeEpicFormatConfig(raw = {}) {
  const base = { ...DEFAULT_EPIC_FORMAT, squadSystemMap: { ...DEFAULT_EPIC_FORMAT.squadSystemMap } };
  if (raw.template) base.template = String(raw.template).trim();
  if (raw.delimiter) base.delimiter = String(raw.delimiter) || EPIC_DELIM;
  if (raw.defaultSubsystem) base.defaultSubsystem = String(raw.defaultSubsystem).trim();
  if (raw.squadSystemMap && typeof raw.squadSystemMap === 'object') {
    base.squadSystemMap = { ...base.squadSystemMap, ...raw.squadSystemMap };
  }
  if (raw.squadOverrides && typeof raw.squadOverrides === 'object') {
    base.squadOverrides = { ...raw.squadOverrides };
  }
  return base;
}

export function resolveSquadSystem(squad = '', format = DEFAULT_EPIC_FORMAT) {
  const key = String(squad || '').trim().toUpperCase();
  const override = format.squadOverrides?.[key];
  if (override?.system) return String(override.system).trim();
  return format.squadSystemMap?.[key] || key || 'DMS';
}

export function resolveSquadSubsystem(squad = '', format = DEFAULT_EPIC_FORMAT) {
  const key = String(squad || '').trim().toUpperCase();
  const override = format.squadOverrides?.[key];
  if (override?.subsystem) return String(override.subsystem).trim();
  return format.defaultSubsystem || 'NBA';
}

/**
 * Build canonical epic title from org format.
 */
export function buildEpicTitleFromFormat({
  quarter = 'FY27 Q2',
  squad = 'DMS',
  subsystem,
  capability = 'Product Goal',
} = {}, format = DEFAULT_EPIC_FORMAT) {
  const q = String(quarter || '').replace(/\s+/g, ' ').trim();
  const system = resolveSquadSystem(squad, format);
  const sub = String(subsystem || resolveSquadSubsystem(squad, format)).trim();
  const cap = String(capability || 'Product Goal').trim();
  const delim = format.delimiter || EPIC_DELIM;
  const tpl = format.template || DEFAULT_EPIC_FORMAT.template;
  return tpl
    .replace(/\{quarter\}/g, q)
    .replace(/\{system\}/g, system)
    .replace(/\{subsystem\}/g, sub)
    .replace(/\{capability\}/g, cap)
    .replace(/\{program\}/g, system)
    .split(delim)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(delim);
}

export function buildEpicFormatPreview(format = DEFAULT_EPIC_FORMAT) {
  return buildEpicTitleFromFormat({
    quarter: 'FY27 Q2',
    squad: 'DMS',
    subsystem: resolveSquadSubsystem('DMS', format),
    capability: 'Example Capability',
  }, format);
}

export function epicTitleRegexFromFormat(format = DEFAULT_EPIC_FORMAT) {
  return /^FY\d{2}\s+Q\d\s+[-–]\s+\S+\s+[-–]\s+\S+\s+[-–]\s+\S/i;
}

export function validateEpicTitle(title = '', format = DEFAULT_EPIC_FORMAT) {
  const t = String(title || '').trim();
  if (!t) return { valid: false, reason: 'empty' };
  if (epicTitleRegexFromFormat(format).test(t)) return { valid: true };
  if (/^FY\d{2}\s+Q\d/i.test(t)) return { valid: 'partial', reason: 'missing-segments' };
  return { valid: false, reason: 'unstructured' };
}

export function slideVisionNamingRule(format = DEFAULT_EPIC_FORMAT) {
  const preview = buildEpicFormatPreview(format);
  const parts = preview.split(format.delimiter || EPIC_DELIM);
  return `Naming rule for suggestedEpicTitle: ${parts[0]}${format.delimiter}{system}${format.delimiter}{subsystem}${format.delimiter}{capability} (use en-dash – between segments). Example: ${preview}`;
}
