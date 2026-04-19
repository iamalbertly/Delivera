export function emitTelemetry(name, meta = {}) {
  try {
    if (typeof window !== 'undefined') {
      window.__telemetryEvents = window.__telemetryEvents || [];
      window.__telemetryEvents.push({ name, ts: Date.now(), meta });
    }
  } catch (_) {}
}

export function getTelemetry() {
  try {
    return (typeof window !== 'undefined' && window.__telemetryEvents) ? window.__telemetryEvents : [];
  } catch (_) { return []; }
}