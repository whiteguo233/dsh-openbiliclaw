/**
 * Runtime-stream WebSocket client: real-time push events (delight candidates,
 * interest/avoidance probes and their outcomes) with automatic reconnect and
 * a small dedupe window so a reconnect burst does not double-fire.
 * @module @openbiliclaw/dsh-plugin
 */

/** Stream event types the sidebar cares about. */
export type LiveEventType =
  | 'delight.candidate'
  | 'delight.liked'
  | 'delight.disliked'
  | 'delight.chat'
  | 'delight.refreshed'
  | 'interest.probe'
  | 'interest.confirmed'
  | 'interest.rejected'
  | 'interest.deferred'
  | 'interest.chat'
  | 'avoidance.probe'
  | 'avoidance.confirmed'
  | 'avoidance.rejected'
  | 'avoidance.deferred'
  | 'avoidance.chat'

/** One decoded stream message. */
export interface LiveEvent {
  type: string
  payload: Record<string, unknown>
}

const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS = 30_000
const DEDUPE_MS = 500

/**
 * Live client: subscribes to `/api/runtime-stream`, reconnects with
 * exponential backoff, and forwards typed events to subscribers.
 */
export class LiveClient {
  #base: string
  #socket: WebSocket | null = null
  #closed = false
  #timer: number | null = null
  #listeners = new Set<(event: LiveEvent) => void>()
  #lastSeen = new Map<string, number>()
  #onStatus: ((connected: boolean) => void) | null = null
  #reconnectDelay = RECONNECT_BASE_MS

  constructor(base: string) {
    this.#base = base
  }

  /** Subscribe to stream events; returns the unsubscriber. */
  onEvent(listener: (event: LiveEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  /** Observe connection state changes. */
  onStatusChange(listener: (connected: boolean) => void): () => void {
    this.#onStatus = listener
    return () => { if (this.#onStatus === listener) this.#onStatus = null }
  }

  /** Connect (idempotent; reconnects if a socket already died). */
  connect(): void {
    if (this.#closed || this.#socket !== null) return
    this.#open()
  }

  /** Close permanently (no reconnect). */
  dispose(): void {
    this.#closed = true
    if (this.#timer !== null) { window.clearTimeout(this.#timer); this.#timer = null }
    if (this.#socket !== null) {
      this.#socket.onclose = null
      this.#socket.onerror = null
      this.#socket.onmessage = null
      this.#socket.close()
      this.#socket = null
    }
  }

  #open(): void {
    const wsUrl = this.#base.replace(/^http/, 'ws') + '/api/runtime-stream'
    let socket: WebSocket
    try {
      socket = new WebSocket(wsUrl)
    } catch {
      this.#scheduleReconnect()
      return
    }
    this.#socket = socket
    const openedAt = Date.now()
    socket.onopen = () => {
      // Only a connection that survives a while resets the backoff; a
      // quick open/close flap keeps doubling so churn backs off.
      if (Date.now() - openedAt >= 8_000) this.#reconnectDelay = RECONNECT_BASE_MS
      this.#onStatus?.(true)
    }
    socket.onmessage = (msg: MessageEvent<string>) => {
      this.#handleMessage(msg.data)
    }
    socket.onclose = () => {
      if (this.#socket === socket) this.#socket = null
      this.#onStatus?.(false)
      this.#scheduleReconnect()
    }
    socket.onerror = () => {
      // onclose follows; nothing to do here.
    }
  }

  #scheduleReconnect(): void {
    if (this.#closed || this.#timer !== null) return
    const delay = this.#reconnectDelay
    this.#reconnectDelay = Math.min(RECONNECT_MAX_MS, this.#reconnectDelay * 2)
    this.#timer = window.setTimeout(() => {
      this.#timer = null
      if (!this.#closed) this.#open()
    }, delay)
  }

  #handleMessage(raw: string): void {
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof data !== 'object' || data === null) return
    const row = data as Record<string, unknown>
    // Wire shape: { "ok": true, "data": { "type": "...", ...payload } }
    const inner = row.data
    if (typeof inner !== 'object' || inner === null) return
    const payload = inner as Record<string, unknown>
    const type = typeof payload.type === 'string' ? payload.type : ''
    if (type === '' || type === 'connected') return
    const now = Date.now()
    const last = this.#lastSeen.get(type + (typeof payload.bvid === 'string' ? payload.bvid : payload.domain ?? ''))
    if (last !== undefined && now - last < DEDUPE_MS) return
    this.#lastSeen.set(type + (typeof payload.bvid === 'string' ? payload.bvid : payload.domain ?? ''), now)
    const event: LiveEvent = { type, payload }
    for (const listener of [...this.#listeners]) {
      try { listener(event) } catch { /* one bad listener must not kill the stream */ }
    }
  }
}
