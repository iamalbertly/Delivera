export function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return `"${str.replace(/"/g, '""').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')}` + '"';
  }
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
}

export function toUtcIsoFromLocalInput(value, isEndOfDay = false) {
  if (!value) return null;
  const local = new Date(value);
  if (Number.isNaN(local.getTime())) {
    return null;
  }
  if (isEndOfDay) {
    local.setHours(23, 59, 59, 999);
  }
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
}

export function generateCSVClient(columns, rows) {
  const lines = [];
  lines.push(columns.map(escapeCSVField).join(','));
  for (const row of rows) {
    const values = columns.map(col => escapeCSVField(row[col]));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}
