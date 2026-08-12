/**
 * Runtime-stream WebSocket client: real-time push events (delight candidates,
 * interest/avoidance probes and their outcomes) with automatic reconnect and
 * a small dedupe window so a reconnect burst does not double-fire.
 * @module @openbiliclaw/dsh-plugin
 */
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
const DEDUPE_MS = 500;
/**
 * Live client: subscribes to `/api/runtime-stream`, reconnects with
 * exponential backoff, and forwards typed events to subscribers.
 */
export class LiveClient {
    #base;
    #socket = null;
    #closed = false;
    #timer = null;
    #listeners = new Set();
    #lastSeen = new Map();
    #onStatus = null;
    #reconnectDelay = RECONNECT_BASE_MS;
    constructor(base) {
        this.#base = base;
    }
    /** Subscribe to stream events; returns the unsubscriber. */
    onEvent(listener) {
        this.#listeners.add(listener);
        return () => { this.#listeners.delete(listener); };
    }
    /** Observe connection state changes. */
    onStatusChange(listener) {
        this.#onStatus = listener;
        return () => { if (this.#onStatus === listener)
            this.#onStatus = null; };
    }
    /** Connect (idempotent; reconnects if a socket already died). */
    connect() {
        if (this.#closed || this.#socket !== null)
            return;
        this.#open();
    }
    /** Close permanently (no reconnect). */
    dispose() {
        this.#closed = true;
        if (this.#timer !== null) {
            window.clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (this.#socket !== null) {
            this.#socket.onclose = null;
            this.#socket.onerror = null;
            this.#socket.onmessage = null;
            this.#socket.close();
            this.#socket = null;
        }
    }
    #open() {
        const wsUrl = this.#base.replace(/^http/, 'ws') + '/api/runtime-stream';
        let socket;
        try {
            socket = new WebSocket(wsUrl);
        }
        catch {
            this.#scheduleReconnect();
            return;
        }
        this.#socket = socket;
        const openedAt = Date.now();
        socket.onopen = () => {
            // Only a connection that survives a while resets the backoff; a
            // quick open/close flap keeps doubling so churn backs off.
            if (Date.now() - openedAt >= 8_000)
                this.#reconnectDelay = RECONNECT_BASE_MS;
            this.#onStatus?.(true);
        };
        socket.onmessage = (msg) => {
            this.#handleMessage(msg.data);
        };
        socket.onclose = () => {
            if (this.#socket === socket)
                this.#socket = null;
            this.#onStatus?.(false);
            this.#scheduleReconnect();
        };
        socket.onerror = () => {
            // onclose follows; nothing to do here.
        };
    }
    #scheduleReconnect() {
        if (this.#closed || this.#timer !== null)
            return;
        const delay = this.#reconnectDelay;
        this.#reconnectDelay = Math.min(RECONNECT_MAX_MS, this.#reconnectDelay * 2);
        this.#timer = window.setTimeout(() => {
            this.#timer = null;
            if (!this.#closed)
                this.#open();
        }, delay);
    }
    #handleMessage(raw) {
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (typeof data !== 'object' || data === null)
            return;
        const row = data;
        // Wire shape: { "ok": true, "data": { "type": "...", ...payload } }
        const inner = row.data;
        if (typeof inner !== 'object' || inner === null)
            return;
        const payload = inner;
        const type = typeof payload.type === 'string' ? payload.type : '';
        if (type === '' || type === 'connected')
            return;
        const now = Date.now();
        const last = this.#lastSeen.get(type + (typeof payload.bvid === 'string' ? payload.bvid : payload.domain ?? ''));
        if (last !== undefined && now - last < DEDUPE_MS)
            return;
        this.#lastSeen.set(type + (typeof payload.bvid === 'string' ? payload.bvid : payload.domain ?? ''), now);
        const event = { type, payload };
        for (const listener of [...this.#listeners]) {
            try {
                listener(event);
            }
            catch { /* one bad listener must not kill the stream */ }
        }
    }
}
//# sourceMappingURL=live.js.map