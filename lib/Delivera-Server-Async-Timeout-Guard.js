export async function runWithTimeoutGuard(task, options = {}) {
    const timeoutMsRaw = Number(options.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 45000;
    const timeoutMessage = String(options.timeoutMessage || `Operation timed out after ${timeoutMs}ms`);
    let timeoutHandle = null;
    let timedOut = false;
    try {
        return await Promise.race([
            task(),
            new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    timedOut = true;
                    if (typeof options.onTimeout === 'function') {
                        try {
                            options.onTimeout();
                        } catch (_) {
                            // best effort
                        }
                    }
                    const error = new Error(timeoutMessage);
                    error.code = String(options.timeoutCode || 'ASYNC_TIMEOUT');
                    reject(error);
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (timedOut && typeof options.onAfterTimeout === 'function') {
            try {
                options.onAfterTimeout();
            } catch (_) {
                // best effort
            }
        }
    }
}
