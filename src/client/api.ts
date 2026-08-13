/**
 * OpenBiliClaw REST client for the browser half. Talks to the user's local
 * backend directly (CORS is permissive); the base URL is user-configurable
 * and persisted in localStorage. Only user-consumption endpoints are used —
 * nothing crawling/source-management related.
 * @module @openbiliclaw/dsh-plugin
 */

/** localStorage key for the API base URL. */
export const API_BASE_KEY = 'openbiliclaw.apiBase'

/** Default local backend address. */
export const DEFAULT_API_BASE = 'http://127.0.0.1:8420'

/** Read the persisted API base URL (falling back to the default). */
export function readApiBase(): string {
  try {
    const saved = localStorage.getItem(API_BASE_KEY)
    if (saved !== null && saved.trim() !== '') return saved.trim().replace(/\/+$/, '')
  } catch {
    // localStorage unavailable (private mode etc.) — use the default.
  }
  return DEFAULT_API_BASE
}

/** Persist the API base URL. */
export function writeApiBase(base: string): void {
  try {
    localStorage.setItem(API_BASE_KEY, base.trim().replace(/\/+$/, ''))
  } catch {
    // ignore persistence failures
  }
}

/** One recommendation card (RecommendationOut, defensive subset). */
export interface RecommendationItem {
  id: number
  bvid: string
  item_key: string
  title: string
  up_name: string
  cover_url: string
  expression: string
  topic_label: string
  content_id: string
  content_url: string
  source_platform: string
  content_type: string
  body_text: string
  published_label: string
  published_at: string
  presented: boolean
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  danmaku_count: number
  favorite_count: number
}

/** One proactive delight card (PendingDelightOut subset). */
export interface DelightItem {
  bvid: string
  item_key: string
  content_id: string
  title: string
  delight_reason: string
  delight_score: number
  delight_hook: string
  cover_url: string
  content_url: string
  source_platform: string
  published_label: string
  content_type: string
  body_text: string
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  danmaku_count: number
  favorite_count: number
  state?: string
}

/** One probe hypothesis (interest or avoidance). */
export interface ProbeItem {
  domain: string
  reason: string
  confidence: number
  status: string
  probe_mode?: string
  challenge?: string
}

/** One saved membership (SavedListItem subset). */
export interface SavedItem {
  item_key: string
  source_platform: string
  content_id: string
  content_url: string
  content_type: string
  title: string
  author_name: string
  cover_url: string
  note: string
  added_at: string
  sync_status: string
}

/** One chat turn. */
export interface ChatTurn {
  turn_id: string
  session: string
  scope: string
  message: string
  reply: string
  status: string
  error: string
  subject_title: string
  created_at?: string
  updated_at?: string
  reply_to_turn_id?: string
  payload?: Record<string, unknown>
}

/** One 30-day content-history item. */
export interface ContentHistoryItem {
  item_key: string
  source_platform: string
  content_id: string
  content_url: string
  content_type: string
  title: string
  author_name: string
  cover_url: string
  body_text: string
  recommendation_id: number | null
  occurred_at: string
  context: string
  restored: boolean
  contexts: Array<{ context: string; occurred_at: string; restored: boolean }>
}

/** One pending dialogue confirmation (hypothesis/confusion). */
export interface PendingConfirmation {
  ref: string
  kind: string
  title: string
  confidence: number
  evidence: string[]
  status: string
  /** Confusion items: what the system observed and how it reads it. */
  observation: string
  interpretation: string
}

/** Full profile summary (canonical surface fields). */
export interface ProfileSummary {
  initialized: boolean
  personality_portrait: string
  core_traits: string[]
  deep_needs: string[]
  mbti: { type: string; confidence: number; dimensions?: Record<string, { pole: string; strength: number }> }
  values: string[]
  motivational_drivers: string[]
  likes: Array<{ domain: string; weight: number; specifics: Array<{ name: string; weight: number }> }>
  dislikes: Array<{ domain: string; weight: number; specifics: Array<{ name: string; weight: number }> }>
  favorite_up_users: string[]
  life_stage: string
  current_phase: string
  cognitive_style: string[]
  exploration_openness: number
  style: { preferred_duration: string; preferred_pace: string; quality_sensitivity: number; humor_preference: number; depth_preference: number }
  context: { weekday_patterns: string; weekend_patterns: string; time_of_day_patterns: string; session_type: string }
  speculative_interests: Array<{ domain: string; reason: string; confidence: number; status: string; specifics: unknown[]; confirmation_count: number; confirmation_threshold: number; probe_mode?: string; challenge?: boolean }>
  speculative_avoidances: Array<{ domain: string; reason: string; confidence: number; status: string; specifics: unknown[]; confirmation_count: number; confirmation_threshold: number }>
  active_insights: Array<{ hypothesis: string; evidence: string[]; confidence: number; validated: boolean; created_at?: string }>
  recent_awareness: Array<{ date: string; observation: string; trend: string; emotion_guess: string }>
}

/** One activity feed item. */
export interface ActivityItem {
  id?: string
  kind?: string
  summary?: string
  occurred_at?: string
  [key: string]: unknown
}

/** Runtime status (defensive subset). */
export interface RuntimeStatus {
  initialized: boolean
  recommendation_count: number
  unread_count: number
  last_refresh_at: string
  pool_available_count: number
  pool_target_count: number
  pool_pending_count: number
  last_replenished_count: number
  last_discovered_count: number
  recent_pool_topics: string[]
  manual_refresh_state: string
  [key: string]: unknown
}

/** Request error carrying the HTTP status and server detail. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(path: string, status: number, detail: unknown) {
    super(`${path} failed: ${status}`)
    this.status = status
    this.detail = detail
  }
}

/** Minimal timeout helper: AbortController + cleanup. */
function withTimeout(ms: number, outer?: AbortSignal): { signal?: AbortSignal; cleanup(): void } {
  if (ms <= 0) return { cleanup() { /* no-op */ } }
  const controller = new AbortController()
  const onOuterAbort = (): void => controller.abort()
  if (outer !== undefined) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', onOuterAbort, { once: true })
  }
  const timer = window.setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    cleanup() {
      window.clearTimeout(timer)
      outer?.removeEventListener('abort', onOuterAbort)
    },
  }
}

/** One raw JSON request against the OpenBiliClaw backend. */
export async function requestJson(
  base: string,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<unknown> {
  const { method = 'GET', body, headers, timeoutMs = 15_000, signal } = options
  const timeout = withTimeout(timeoutMs, signal)
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      credentials: 'omit',
      signal: timeout.signal,
      headers: body === undefined && headers === undefined ? undefined : { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      let detail: unknown = null
      try { detail = await res.json() } catch { detail = null }
      throw new ApiError(path, res.status, detail)
    }
    return res.json()
  } finally {
    timeout.cleanup()
  }
}

function asItems(value: unknown): Array<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return []
  const items = (value as Record<string, unknown>).items
  return Array.isArray(items) ? items as Array<Record<string, unknown>> : []
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Decode the HTML entities the crawler occasionally leaves in text fields
 *  (e.g. `&gt;&gt;&gt;`); `&amp;` is decoded last so double-escaped text unwraps once. */
function decodeEntities(value: string): string {
  if (value.indexOf('&') === -1) return value
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function str(value: unknown): string {
  return typeof value === 'string' ? decodeEntities(value) : ''
}

/** Defensive coercion of one recommendation row. */
function toRecommendation(row: Record<string, unknown>): RecommendationItem {
  return {
    id: num(row.id),
    bvid: str(row.bvid),
    item_key: str(row.item_key),
    title: str(row.title),
    up_name: str(row.up_name),
    cover_url: str(row.cover_url),
    expression: str(row.expression),
    topic_label: str(row.topic_label),
    content_id: str(row.content_id),
    content_url: str(row.content_url),
    source_platform: str(row.source_platform),
    content_type: str(row.content_type),
    body_text: str(row.body_text),
    published_label: str(row.published_label),
    published_at: str(row.published_at),
    presented: row.presented === true,
    view_count: num(row.view_count),
    like_count: num(row.like_count),
    comment_count: num(row.comment_count),
    share_count: num(row.share_count),
    danmaku_count: num(row.danmaku_count),
    favorite_count: num(row.favorite_count),
  }
}

/** Defensive coercion of one delight row. */
function toDelight(row: Record<string, unknown>): DelightItem {
  return {
    bvid: str(row.bvid),
    item_key: str(row.item_key),
    content_id: str(row.content_id),
    title: str(row.title),
    delight_reason: str(row.delight_reason),
    delight_score: num(row.delight_score),
    delight_hook: str(row.delight_hook),
    cover_url: str(row.cover_url),
    content_url: str(row.content_url),
    source_platform: str(row.source_platform),
    published_label: str(row.published_label),
    content_type: str(row.content_type),
    body_text: str(row.body_text),
    view_count: num(row.view_count),
    like_count: num(row.like_count),
    comment_count: num(row.comment_count),
    share_count: num(row.share_count),
    danmaku_count: num(row.danmaku_count),
    favorite_count: num(row.favorite_count),
    state: str(row.state),
  }
}

/** Defensive coercion of one probe row. */
function toProbe(row: Record<string, unknown>): ProbeItem {
  return {
    domain: str(row.domain),
    reason: str(row.reason),
    confidence: num(row.confidence),
    status: str(row.status),
    probe_mode: str(row.probe_mode),
    challenge: str(row.challenge),
  }
}

/** Defensive coercion of one saved row. */
function toSaved(row: Record<string, unknown>): SavedItem {
  return {
    item_key: str(row.item_key),
    source_platform: str(row.source_platform),
    content_id: str(row.content_id),
    content_url: str(row.content_url),
    content_type: str(row.content_type),
    title: str(row.title),
    author_name: str(row.author_name),
    cover_url: str(row.cover_url),
    note: str(row.note),
    added_at: str(row.added_at),
    sync_status: str(row.sync_status),
  }
}

// ── Endpoints (user-consumption surface only) ───────────────────────────────

/** GET /api/recommendations — the current recommendation snapshot. */
export async function fetchRecommendations(base: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await requestJson(base, '/api/recommendations', { timeoutMs: 20_000, signal })
  return asItems(data).map(toRecommendation)
}

/** POST /api/recommendations/reshuffle — replace the current page. */
export async function reshuffleRecommendations(
  base: string,
  opts: { sourcePlatform?: string; excludedBvids?: string[] } = {},
  signal?: AbortSignal,
): Promise<RecommendationItem[]> {
  const body: Record<string, unknown> = {}
  if (opts.sourcePlatform !== undefined && opts.sourcePlatform !== '') body.source_platform = opts.sourcePlatform
  if (opts.excludedBvids !== undefined && opts.excludedBvids.length > 0) body.excluded_bvids = opts.excludedBvids
  const data = await requestJson(base, '/api/recommendations/reshuffle', { method: 'POST', body, timeoutMs: 20_000, signal })
  return asItems(data).map(toRecommendation)
}

/** POST /api/recommendations/append — append another page. */
export async function appendRecommendations(
  base: string,
  opts: { sourcePlatform?: string; excludedBvids?: string[] } = {},
  signal?: AbortSignal,
): Promise<RecommendationItem[]> {
  const body: Record<string, unknown> = {}
  if (opts.sourcePlatform !== undefined && opts.sourcePlatform !== '') body.source_platform = opts.sourcePlatform
  if (opts.excludedBvids !== undefined && opts.excludedBvids.length > 0) body.excluded_bvids = opts.excludedBvids
  const data = await requestJson(base, '/api/recommendations/append', { method: 'POST', body, timeoutMs: 20_000, signal })
  return asItems(data).map(toRecommendation)
}

/** POST /api/recommendation-click — record a click-through (stable request_id). */
export async function reportClick(
  base: string,
  payload: { recommendation_id?: number; content_id?: string; bvid?: string; content_url?: string; source_platform?: string; title?: string; request_id: string },
  signal?: AbortSignal,
): Promise<void> {
  await requestJson(base, '/api/recommendation-click', { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal })
}

/** POST /api/feedback — durable card feedback (stable request_id). */
export async function submitFeedback(
  base: string,
  payload: { recommendation_id: number; feedback_type: string; note?: string; request_id: string },
  signal?: AbortSignal,
): Promise<void> {
  await requestJson(base, '/api/feedback', { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal })
}

/** GET /api/delight/pending-batch — the full un-notified delight queue. */
export async function fetchDelightBatch(base: string, signal?: AbortSignal): Promise<DelightItem[]> {
  const data = await requestJson(base, '/api/delight/pending-batch?limit=20', { timeoutMs: 15_000, signal })
  return asItems(data).map(toDelight)
}

/** GET /api/notifications/pending — one notification-worthy recommendation. */
export async function fetchPendingNotification(base: string, signal?: AbortSignal): Promise<{ recommendation_id: number; bvid: string; title: string; reason: string } | null> {
  try {
    const data = await requestJson(base, '/api/notifications/pending', { timeoutMs: 8_000, signal })
    if (typeof data !== 'object' || data === null) return null
    const row = (data as Record<string, unknown>).item
    if (typeof row !== 'object' || row === null) return null
    const item = row as Record<string, unknown>
    return {
      recommendation_id: num(item.recommendation_id),
      bvid: str(item.bvid),
      title: str(item.title),
      reason: str(item.reason),
    }
  } catch {
    return null
  }
}

/** POST /api/delight/respond — view/like/dislike/dismiss/chat (stable request_id). */
export async function respondToDelight(
  base: string,
  payload: { bvid: string; response: string; title?: string; message?: string; request_id: string },
  signal?: AbortSignal,
): Promise<unknown> {
  return requestJson(base, '/api/delight/respond', { method: 'POST', body: { ...payload }, timeoutMs: 20_000, signal })
}

/** GET /api/interest-probes/pending — active speculative interests. */
export async function fetchInterestProbes(base: string, signal?: AbortSignal): Promise<ProbeItem[]> {
  const data = await requestJson(base, '/api/interest-probes/pending', { timeoutMs: 10_000, signal })
  return asItems(data).map(toProbe)
}

/** POST /api/interest-probes/respond — confirm/reject/defer/chat. */
export async function respondInterestProbe(
  base: string,
  payload: { domain: string; response: string; message?: string },
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, unknown> = { domain: payload.domain, response: payload.response }
  if (payload.message !== undefined && payload.message !== '') body.message = payload.message
  return requestJson(base, '/api/interest-probes/respond', { method: 'POST', body, timeoutMs: 20_000, signal })
}

/** GET /api/avoidance-probes/pending — active speculative avoidances. */
export async function fetchAvoidanceProbes(base: string, signal?: AbortSignal): Promise<ProbeItem[]> {
  const data = await requestJson(base, '/api/avoidance-probes/pending', { timeoutMs: 10_000, signal })
  return asItems(data).map(toProbe)
}

/** POST /api/avoidance-probes/respond — confirm/reject/defer/chat. */
export async function respondAvoidanceProbe(
  base: string,
  payload: { domain: string; response: string; message?: string },
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, unknown> = { domain: payload.domain, response: payload.response }
  if (payload.message !== undefined && payload.message !== '') body.message = payload.message
  return requestJson(base, '/api/avoidance-probes/respond', { method: 'POST', body, timeoutMs: 20_000, signal })
}

/** POST /api/chat — one Socratic dialogue exchange (returns { reply }). */
export async function sendChat(base: string, message: string, signal?: AbortSignal): Promise<{ reply: string }> {
  const data = await requestJson(base, '/api/chat', { method: 'POST', body: { message }, timeoutMs: 300_000, signal })
  const reply = typeof data === 'object' && data !== null ? str((data as Record<string, unknown>).reply) : ''
  return { reply }
}

/** Defensive coercion of one chat turn row. */
function toChatTurn(row: Record<string, unknown>): ChatTurn {
  return {
    turn_id: str(row.turn_id),
    session: str(row.session),
    scope: str(row.scope),
    message: str(row.message),
    reply: str(row.reply),
    status: str(row.status),
    error: str(row.error),
    subject_title: str(row.subject_title),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
    reply_to_turn_id: str(row.reply_to_turn_id),
    payload: typeof row.payload === 'object' && row.payload !== null ? row.payload as Record<string, unknown> : undefined,
  }
}

/** GET /api/chat/turns — durable dialogue history. */
export async function fetchChatTurns(base: string, session = 'dsh', signal?: AbortSignal): Promise<ChatTurn[]> {
  const data = await requestJson(base, `/api/chat/turns?session=${encodeURIComponent(session)}&limit=50`, { timeoutMs: 10_000, signal })
  return asItems(data).map(toChatTurn)
}

/** POST /api/chat/turns — start one durable dialogue turn (returns the pending turn). */
export async function startChatTurn(base: string, message: string, session = 'dsh', replyToTurnId?: string, signal?: AbortSignal): Promise<ChatTurn> {
  const body: Record<string, unknown> = { session, scope: 'chat', message }
  if (replyToTurnId !== undefined && replyToTurnId !== '') body.reply_to_turn_id = replyToTurnId
  const data = await requestJson(base, '/api/chat/turns', {
    method: 'POST',
    body,
    timeoutMs: 20_000,
    signal,
  })
  if (typeof data !== 'object' || data === null) throw new Error('chat/turns: unexpected response')
  return toChatTurn(data as Record<string, unknown>)
}

/** GET /api/chat/turns/{turn_id} — poll one durable turn until it settles. */
export async function fetchChatTurn(base: string, turnId: string, signal?: AbortSignal): Promise<ChatTurn> {
  const data = await requestJson(base, `/api/chat/turns/${encodeURIComponent(turnId)}`, { timeoutMs: 15_000, signal })
  if (typeof data !== 'object' || data === null) throw new Error('chat/turns: unexpected response')
  return toChatTurn(data as Record<string, unknown>)
}

/** GET /api/chat/pending-confirmations — hypotheses/confusions waiting for the user. */
export async function fetchPendingConfirmations(base: string, signal?: AbortSignal): Promise<{ count: number; items: PendingConfirmation[] }> {
  const data = await requestJson(base, '/api/chat/pending-confirmations', { timeoutMs: 10_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  const items = Array.isArray(row.items) ? row.items as Array<Record<string, unknown>> : []
  return {
    count: num(row.count),
    items: items.map(item => ({
      ref: str(item.ref),
      kind: str(item.kind),
      title: str(item.title ?? item.hypothesis),
      confidence: num(item.confidence),
      evidence: Array.isArray(item.evidence_refs) ? item.evidence_refs.map(String) : [],
      status: str(item.status),
      observation: str(item.observation),
      interpretation: str(item.interpretation),
    })),
  }
}

/** POST /api/chat/pending-confirmations/{ref}/open — turn a confirmation into a chat turn. */
export async function openPendingConfirmation(base: string, ref: string, signal?: AbortSignal): Promise<ChatTurn> {
  const data = await requestJson(base, `/api/chat/pending-confirmations/${encodeURIComponent(ref)}/open`, {
    method: 'POST',
    body: { session: 'dsh' },
    timeoutMs: 20_000,
    signal,
  })
  if (typeof data !== 'object' || data === null) throw new Error('pending-confirmations/open: unexpected response')
  return toChatTurn(data as Record<string, unknown>)
}

/** POST /api/chat/cards/{turn_id}/action — confirm/reject/discuss/defer a hypothesis card.
 *  Returns the settlement response (state/verdict are authoritative). */
export async function actOnChatCard(base: string, turnId: string, action: string, signal?: AbortSignal): Promise<unknown> {
  return requestJson(base, `/api/chat/cards/${encodeURIComponent(turnId)}/action`, {
    method: 'POST',
    body: { action },
    timeoutMs: 20_000,
    signal,
  })
}

/** GET /api/content-history — one paginated 30-day history category. */
export async function fetchContentHistory(
  base: string,
  category: 'clicked' | 'shown' | 'removed',
  cursor = '',
  signal?: AbortSignal,
): Promise<{ items: ContentHistoryItem[]; total: number; hasMore: boolean; nextCursor: string; retentionDays: number }> {
  const params = new URLSearchParams({ category, limit: '12' })
  if (cursor !== '') params.set('cursor', cursor)
  const data = await requestJson(base, `/api/content-history?${params.toString()}`, { timeoutMs: 15_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return {
    items: (Array.isArray(row.items) ? row.items as Array<Record<string, unknown>> : []).map(item => ({
      item_key: str(item.item_key),
      source_platform: str(item.source_platform),
      content_id: str(item.content_id),
      content_url: str(item.content_url),
      content_type: str(item.content_type),
      title: str(item.title),
      author_name: str(item.author_name),
      cover_url: str(item.cover_url),
      body_text: str(item.body_text),
      recommendation_id: item.recommendation_id === null || item.recommendation_id === undefined ? null : num(item.recommendation_id),
      occurred_at: str(item.occurred_at),
      context: str(item.context),
      restored: item.restored === true,
      contexts: Array.isArray(item.contexts)
        ? (item.contexts as Array<Record<string, unknown>>).map(ctx => ({
          context: str(ctx.context),
          occurred_at: str(ctx.occurred_at),
          restored: ctx.restored === true,
        }))
        : [],
    })),
    total: num(row.total),
    hasMore: row.has_more === true,
    nextCursor: str(row.next_cursor),
    retentionDays: num(row.retention_days),
  }
}

/** GET /api/saved/{listKind}/status — saved state for one item (toggle display). */
export async function fetchSavedStatus(base: string, listKind: 'favorite' | 'watch_later', itemKey: string, signal?: AbortSignal): Promise<boolean> {
  const data = await requestJson(base, `/api/saved/${listKind}/status?item_key=${encodeURIComponent(itemKey)}`, { timeoutMs: 8_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return row.saved === true
}

/** GET /api/saved/{listKind} — favorite or watch_later memberships. */
export async function fetchSaved(base: string, listKind: 'favorite' | 'watch_later', signal?: AbortSignal): Promise<SavedItem[]> {
  const data = await requestJson(base, `/api/saved/${listKind}`, { timeoutMs: 10_000, signal })
  return asItems(data).map(toSaved)
}

/** POST /api/saved/{listKind} — add one membership. */
export async function saveItem(
  base: string,
  listKind: 'favorite' | 'watch_later',
  payload: { source_platform: string; content_id: string; content_url?: string; content_type?: string; title?: string; author_name?: string; cover_url?: string },
  signal?: AbortSignal,
): Promise<void> {
  await requestJson(base, `/api/saved/${listKind}`, { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal })
}

/** POST /api/saved/{listKind}/remove — remove one membership. */
export async function removeSaved(base: string, listKind: 'favorite' | 'watch_later', itemKey: string, signal?: AbortSignal): Promise<void> {
  await requestJson(base, `/api/saved/${listKind}/remove`, { method: 'POST', body: { item_key: itemKey }, timeoutMs: 10_000, signal })
}

/** GET /api/config — the full backend config (masked secrets). */
export async function fetchConfig(base: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const data = await requestJson(base, '/api/config', { timeoutMs: 15_000, signal })
  return typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
}

/** PUT /api/config — partial update; only provided fields are modified and
 *  the backend persists + hot-reloads. */
export async function updateConfig(base: string, partial: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  return requestJson(base, '/api/config', { method: 'PUT', body: partial, timeoutMs: 30_000, signal })
}

/** GET /api/runtime-status — backend readiness and counts. */
export async function fetchRuntimeStatus(base: string, signal?: AbortSignal): Promise<RuntimeStatus | null> {
  try {
    const data = await requestJson(base, '/api/runtime-status', { timeoutMs: 8_000, signal })
    if (typeof data !== 'object' || data === null) return null
    const row = data as Record<string, unknown>
    return {
      initialized: row.initialized === true,
      recommendation_count: num(row.recommendation_count),
      unread_count: num(row.unread_count),
      last_refresh_at: str(row.last_refresh_at),
      pool_available_count: num(row.pool_available_count),
      pool_target_count: num(row.pool_target_count),
      pool_pending_count: num(row.pool_pending_count),
      last_replenished_count: num(row.last_replenished_count),
      last_discovered_count: num(row.last_discovered_count),
      recent_pool_topics: Array.isArray(row.recent_pool_topics) ? row.recent_pool_topics.map(String) : [],
      manual_refresh_state: str(row.manual_refresh_state),
      ...row,
    }
  } catch {
    return null
  }
}

/** GET /api/health — reachability probe. */
export async function fetchHealth(base: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const data = await requestJson(base, '/api/health', { timeoutMs: 5_000, signal })
    return typeof data === 'object' && data !== null && (data as Record<string, unknown>).status === 'ok'
  } catch {
    return false
  }
}

/** GET /api/profile-summary — the AI profile summary (canonical surface shape). */
export async function fetchProfileSummary(base: string, signal?: AbortSignal): Promise<ProfileSummary | null> {
  try {
    const data = await requestJson(base, '/api/profile-summary?limit=5', { timeoutMs: 10_000, signal })
    if (typeof data !== 'object' || data === null) return null
    const row = data as Record<string, unknown>
    const mbti = typeof row.mbti === 'object' && row.mbti !== null ? row.mbti as Record<string, unknown> : {}
    const toDomain = (raw: unknown) => {
      if (typeof raw !== 'object' || raw === null) return { domain: '', weight: 0, specifics: [] }
      const d = raw as Record<string, unknown>
      return {
        domain: str(d.domain),
        weight: num(d.weight),
        specifics: Array.isArray(d.specifics)
          ? (d.specifics as Array<Record<string, unknown>>).map(s => ({ name: str(s.name), weight: num(s.weight) }))
          : [],
      }
    }
    const toProbe = (raw: unknown) => {
      if (typeof raw !== 'object' || raw === null) return null
      const p = raw as Record<string, unknown>
      return {
        domain: str(p.domain),
        reason: str(p.reason),
        confidence: num(p.confidence),
        status: str(p.status),
        specifics: Array.isArray(p.specifics) ? p.specifics : [],
        confirmation_count: num(p.confirmation_count),
        confirmation_threshold: num(p.confirmation_threshold),
        probe_mode: str(p.probe_mode),
        challenge: p.challenge === true,
      }
    }
    return {
      initialized: row.initialized === true,
      personality_portrait: str(row.personality_portrait),
      core_traits: Array.isArray(row.core_traits) ? row.core_traits.map(String) : [],
      deep_needs: Array.isArray(row.deep_needs) ? row.deep_needs.map(String) : [],
      mbti: {
        type: str(mbti.type),
        confidence: num(mbti.confidence),
        dimensions: typeof mbti.dimensions === 'object' && mbti.dimensions !== null
          ? mbti.dimensions as Record<string, { pole: string; strength: number }>
          : undefined,
      },
      values: Array.isArray(row.values) ? row.values.map(String) : [],
      motivational_drivers: Array.isArray(row.motivational_drivers) ? row.motivational_drivers.map(String) : [],
      likes: Array.isArray(row.likes) ? row.likes.map(toDomain) : [],
      dislikes: Array.isArray(row.dislikes) ? row.dislikes.map(toDomain) : [],
      favorite_up_users: Array.isArray(row.favorite_up_users) ? row.favorite_up_users.map(String) : [],
      life_stage: str(row.life_stage),
      current_phase: str(row.current_phase),
      cognitive_style: Array.isArray(row.cognitive_style) ? row.cognitive_style.map(String) : [],
      exploration_openness: num(row.exploration_openness),
      style: (() => {
        const s = typeof row.style === 'object' && row.style !== null ? row.style as Record<string, unknown> : {}
        return {
          preferred_duration: str(s.preferred_duration),
          preferred_pace: str(s.preferred_pace),
          quality_sensitivity: num(s.quality_sensitivity),
          humor_preference: num(s.humor_preference),
          depth_preference: num(s.depth_preference),
        }
      })(),
      context: (() => {
        const c = typeof row.context === 'object' && row.context !== null ? row.context as Record<string, unknown> : {}
        return {
          weekday_patterns: str(c.weekday_patterns),
          weekend_patterns: str(c.weekend_patterns),
          time_of_day_patterns: str(c.time_of_day_patterns),
          session_type: str(c.session_type),
        }
      })(),
      speculative_interests: Array.isArray(row.speculative_interests) ? row.speculative_interests.map(toProbe).filter((p): p is NonNullable<typeof p> => p !== null) : [],
      speculative_avoidances: Array.isArray(row.speculative_avoidances) ? row.speculative_avoidances.map(toProbe).filter((p): p is NonNullable<typeof p> => p !== null) : [],
      active_insights: Array.isArray(row.active_insights)
        ? (row.active_insights as Array<Record<string, unknown>>).map(i => ({
          hypothesis: str(i.hypothesis),
          evidence: Array.isArray(i.evidence) ? i.evidence.map(String) : [],
          confidence: num(i.confidence),
          validated: i.validated === true,
          created_at: str(i.created_at),
        }))
        : [],
      recent_awareness: Array.isArray(row.recent_awareness)
        ? (row.recent_awareness as Array<Record<string, unknown>>).map(a => ({
          date: str(a.date),
          observation: str(a.observation),
          trend: str(a.trend),
          emotion_guess: str(a.emotion_guess),
        }))
        : [],
    }
  } catch {
    return null
  }
}

/** GET /api/activity-feed — recent activity entries (cursor pagination). */
export async function fetchActivityFeed(
  base: string,
  opts: { limit?: number; before?: string } = {},
  signal?: AbortSignal,
): Promise<{ items: ActivityItem[]; liveSummary: string; headline: string; hasMore: boolean; nextCursor: string }> {
  const params = new URLSearchParams()
  if (opts.limit !== undefined) params.set('limit', String(Math.max(1, Math.min(100, opts.limit))))
  if (opts.before !== undefined && opts.before !== '') params.set('before', opts.before)
  const qs = params.toString()
  const data = await requestJson(base, `/api/activity-feed${qs !== '' ? `?${qs}` : ''}`, { timeoutMs: 10_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return {
    items: asItems(data),
    liveSummary: str(row.live_summary),
    headline: str(row.headline),
    hasMore: row.has_more === true,
    nextCursor: str(row.next_cursor),
  }
}

/** Generate one stable idempotency key for a UI action (uuid v4). */
export function stableId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ── settings-page endpoints (mirror the popup's config surface) ──────────

/** Result of one no-write connectivity probe (`POST /api/config/probe-service`). */
export interface ProbeResult {
  ok: boolean
  provider: string
  model: string
  message: string
  error: string
  latencyMs: number
}

/** One v2 LLM instance row as exchanged with `/api/config`. */
export interface LlmInstance {
  name: string
  provider_type: string
  enabled: boolean
  api_key: string
  model: string
  base_url: string
  auth_mode: string
  api_flavor: string
  http_referer: string
  x_title: string
  reasoning_effort: string
  num_ctx: number
}

/** `/api/config/discover-models` response. */
export interface ModelDiscoveryResult {
  ok: boolean
  models: string[]
  reasoningEfforts: string[]
  error: string
}

/** `/api/init-status` response (defensive). */
export interface InitStatus {
  initialized: boolean
  running: boolean
}

/** `/api/update-status` response (defensive). */
export interface UpdateStatus {
  current_version: string
  latest_version: string
  latest_tag: string
  state: string
  reason: string
  last_check_at: string
  error: string
  install_mode: string
}

/** Probe submitted LLM/embedding/proxy settings without saving config.toml. */
export async function probeConfigService(
  base: string,
  kind: 'llm' | 'llm_instance' | 'llm_chain' | 'embedding' | 'network_proxy',
  config: Record<string, unknown>,
  instanceId = '',
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const data = await requestJson(base, '/api/config/probe-service', {
    method: 'POST',
    timeoutMs: 60_000,
    signal,
    body: { kind, instance_id: instanceId, config },
  })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return {
    ok: row.ok === true,
    provider: str(row.provider),
    model: str(row.model),
    message: str(row.message),
    error: str(row.error),
    latencyMs: num(row.latency_ms),
  }
}

/** List models for one submitted instance without saving config.toml. */
export async function discoverConfigModels(
  base: string,
  instanceId: string,
  config: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ModelDiscoveryResult> {
  const data = await requestJson(base, '/api/config/discover-models', {
    method: 'POST',
    timeoutMs: 60_000,
    signal,
    body: { instance_id: instanceId, config },
  })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  const models = Array.isArray(row.models) ? row.models.map(item => String(item)) : []
  const reasoningEfforts = Array.isArray(row.reasoning_efforts) ? row.reasoning_efforts.map(item => String(item)) : []
  return {
    ok: row.ok === true,
    models,
    reasoningEfforts,
    error: str(row.error),
  }
}

/** Read the LAN password-gate status. */
export async function fetchAuthStatus(base: string, signal?: AbortSignal): Promise<{ enabled: boolean }> {
  const data = await requestJson(base, '/api/auth/status', { timeoutMs: 10_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return { enabled: row.enabled === true }
}

/** Enable/disable the LAN password gate (local-only admin surface). */
export async function setLanAuth(base: string, enabled: boolean, password: string, signal?: AbortSignal): Promise<boolean> {
  const data = await requestJson(base, '/api/auth/admin', {
    method: 'POST',
    timeoutMs: 15_000,
    signal,
    headers: { 'X-OBC-Auth': '1' },
    body: enabled ? { enabled: true, password } : { enabled: false },
  })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return row.ok === true
}

/** Read boot-autostart state. */
export async function fetchAutostartStatus(base: string, signal?: AbortSignal): Promise<{ enabled: boolean }> {
  const data = await requestJson(base, '/api/autostart-status', { timeoutMs: 10_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return { enabled: row.enabled === true }
}

/** Apply boot-autostart on/off. */
export async function applyAutostart(base: string, enabled: boolean, signal?: AbortSignal): Promise<boolean> {
  const data = await requestJson(base, '/api/autostart/apply', {
    method: 'POST',
    timeoutMs: 15_000,
    signal,
    headers: { 'X-OBC-Auth': '1' },
    body: { enabled: Boolean(enabled) },
  })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return row.ok === true || row.enabled === enabled
}

/** Read init status. */
export async function fetchInitStatus(base: string, signal?: AbortSignal): Promise<InitStatus> {
  const data = await requestJson(base, '/api/init-status', { timeoutMs: 45_000, signal })
  const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  return { initialized: row.initialized === true, running: row.running === true }
}

/** Restart initialization (rebuild profile + discovery pool). */
export async function startInit(base: string, payload: { force?: boolean; reset_cognition?: boolean }, signal?: AbortSignal): Promise<void> {
  await requestJson(base, '/api/init', { method: 'POST', timeoutMs: 60_000, signal, body: payload })
}

/** Read backend update status. */
export async function fetchUpdateStatus(base: string, signal?: AbortSignal): Promise<UpdateStatus> {
  const asDict = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const data = await requestJson(base, '/api/update-status', { timeoutMs: 10_000, signal })
  const root = asDict(data)
  const row = Object.keys(asDict(root.backend)).length > 0 ? asDict(root.backend) : root
  return {
    current_version: str(row.current_version),
    latest_version: str(row.latest_version),
    latest_tag: str(row.latest_tag),
    state: str(row.state),
    reason: str(row.reason),
    last_check_at: str(row.last_check_at),
    error: str(row.last_error),
    install_mode: str(row.install_mode),
  }
}

/** Trigger an immediate backend update check. */
export async function checkBackendUpdate(base: string, signal?: AbortSignal): Promise<unknown> {
  return requestJson(base, '/api/update/check', {
    method: 'POST', timeoutMs: 60_000, signal, body: { include_backend: true },
  })
}

/** Start applying a backend update (backend restarts afterwards). */
export async function applyBackendUpdate(base: string, tag: string, signal?: AbortSignal): Promise<unknown> {
  return requestJson(base, '/api/update/apply', {
    method: 'POST', timeoutMs: 60_000, signal, body: { target: 'backend', tag },
  })
}

/** GET /api/project-stats — the project summary used by the GitHub star prompt. */
export async function fetchProjectStats(base: string, signal?: AbortSignal): Promise<{ githubStars: number }> {
  try {
    const data = await requestJson(base, '/api/project-stats', { timeoutMs: 6000, signal })
    const row = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
    const n = Number(row.github_stars)
    return { githubStars: Number.isFinite(n) ? n : 0 }
  } catch {
    return { githubStars: 0 }
  }
}
