/** Parse the bridge's single JSON reply object. */
export function parseBridgeLine(text) {
    const trimmed = text.trim();
    if (trimmed === '')
        throw new Error('openbiliclaw bridge: empty reply');
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        throw new Error(`openbiliclaw bridge: non-JSON reply: ${trimmed.slice(0, 400)}`);
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error(`openbiliclaw bridge: unexpected payload shape: ${trimmed.slice(0, 400)}`);
    }
    const reply = parsed;
    if (reply.ok !== true) {
        const err = reply;
        throw new Error(`openbiliclaw bridge error: ${String(err.error ?? err.message ?? 'unknown')}`);
    }
    return { ok: true, data: reply.data };
}
/**
 * Build the bridge face over HTTP to the serve-api's `/api/agent-bridge`
 * endpoint.  The serve-api keeps a warm in-process OpenClawAdapter, so these
 * calls are fast (no Python subprocess per tool call).
 * @param config - resolved plugin config.
 * @returns the bridge face.
 */
export function createBridge(config) {
    const endpoint = `${config.apiUrl.replace(/\/+$/, '')}/api/agent-bridge`;
    return {
        config,
        async run(command, args) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), config.timeoutMs);
            try {
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ command, argv: args }),
                    signal: controller.signal,
                });
                const text = await resp.text();
                if (!resp.ok) {
                    throw new Error(`openbiliclaw bridge HTTP ${resp.status}: ${text.slice(-1500)}`);
                }
                const reply = parseBridgeLine(text);
                return reply.data;
            }
            finally {
                clearTimeout(timer);
            }
        },
    };
}
//# sourceMappingURL=bridge.js.map