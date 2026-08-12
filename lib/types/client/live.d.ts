/**
 * Runtime-stream WebSocket client: real-time push events (delight candidates,
 * interest/avoidance probes and their outcomes) with automatic reconnect and
 * a small dedupe window so a reconnect burst does not double-fire.
 * @module @openbiliclaw/dsh-plugin
 */
/** Stream event types the sidebar cares about. */
export type LiveEventType = 'delight.candidate' | 'delight.liked' | 'delight.disliked' | 'delight.chat' | 'delight.refreshed' | 'interest.probe' | 'interest.confirmed' | 'interest.rejected' | 'interest.deferred' | 'interest.chat' | 'avoidance.probe' | 'avoidance.confirmed' | 'avoidance.rejected' | 'avoidance.deferred' | 'avoidance.chat';
/** One decoded stream message. */
export interface LiveEvent {
    type: string;
    payload: Record<string, unknown>;
}
/**
 * Live client: subscribes to `/api/runtime-stream`, reconnects with
 * exponential backoff, and forwards typed events to subscribers.
 */
export declare class LiveClient {
    #private;
    constructor(base: string);
    /** Subscribe to stream events; returns the unsubscriber. */
    onEvent(listener: (event: LiveEvent) => void): () => void;
    /** Observe connection state changes. */
    onStatusChange(listener: (connected: boolean) => void): () => void;
    /** Connect (idempotent; reconnects if a socket already died). */
    connect(): void;
    /** Close permanently (no reconnect). */
    dispose(): void;
}
//# sourceMappingURL=live.d.ts.map