export function sortSprintsLatestFirst(sprints) {
  if (!Array.isArray(sprints)) return [];
  return [...sprints].sort((a, b) => {
    const aTime = new Date(a.endDate || a.startDate || 0).getTime();
    const bTime = new Date(b.endDate || b.startDate || 0).getTime();
    return bTime - aTime;
  });
}

export function calculateVariance(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return variance;
}
