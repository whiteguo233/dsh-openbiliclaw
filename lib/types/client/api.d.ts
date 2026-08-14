/**
 * OpenBiliClaw REST client for the browser half. Talks to the user's local
 * backend directly (CORS is permissive); the base URL is user-configurable
 * and persisted in localStorage. Only user-consumption endpoints are used —
 * nothing crawling/source-management related.
 * @module @openbiliclaw/dsh-plugin
 */
/** localStorage key for the API base URL. */
export declare const API_BASE_KEY = "openbiliclaw.apiBase";
/** Default local backend address. */
export declare const DEFAULT_API_BASE = "http://127.0.0.1:8420";
/** Read the persisted API base URL (falling back to the default). */
export declare function readApiBase(): string;
/** Persist the API base URL. */
export declare function writeApiBase(base: string): void;
/** One recommendation card (RecommendationOut, defensive subset). */
export interface RecommendationItem {
    id: number;
    bvid: string;
    item_key: string;
    title: string;
    up_name: string;
    cover_url: string;
    expression: string;
    topic_label: string;
    content_id: string;
    content_url: string;
    source_platform: string;
    content_type: string;
    body_text: string;
    published_label: string;
    published_at: string;
    presented: boolean;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    danmaku_count: number;
    favorite_count: number;
}
/** One proactive delight card (PendingDelightOut subset). */
export interface DelightItem {
    bvid: string;
    item_key: string;
    content_id: string;
    title: string;
    delight_reason: string;
    delight_score: number;
    delight_hook: string;
    cover_url: string;
    content_url: string;
    source_platform: string;
    published_label: string;
    content_type: string;
    body_text: string;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    danmaku_count: number;
    favorite_count: number;
    state?: string;
}
/** One probe hypothesis (interest or avoidance). */
export interface ProbeItem {
    domain: string;
    reason: string;
    confidence: number;
    status: string;
    probe_mode?: string;
    challenge?: string;
}
/** One saved membership (SavedListItem subset). */
export interface SavedItem {
    item_key: string;
    source_platform: string;
    content_id: string;
    content_url: string;
    content_type: string;
    title: string;
    author_name: string;
    cover_url: string;
    note: string;
    added_at: string;
    sync_status: string;
    sync_task_id: string;
    requested_action: string;
    resolved_action: string;
    resolved_target: string;
    error_code: string;
    error_message: string;
}
/** One per-item native-sync result inside a saved-sync task. */
export interface SavedSyncItem {
    item_key: string;
    status: string;
    resolved_action: string;
    resolved_target: string;
    error_code: string;
    error_message: string;
}
/** Durable native-sync batch returned at creation and polling. */
export interface SavedSyncBatch {
    task_id: string;
    items: SavedSyncItem[];
}
/** One page of saved memberships with the backend total count. */
export interface SavedListPage {
    items: SavedItem[];
    total: number;
}
/** One chat turn. */
export interface ChatTurn {
    turn_id: string;
    session: string;
    scope: string;
    message: string;
    reply: string;
    status: string;
    error: string;
    subject_title: string;
    created_at?: string;
    updated_at?: string;
    reply_to_turn_id?: string;
    payload?: Record<string, unknown>;
}
/** One 30-day content-history item. */
export interface ContentHistoryItem {
    item_key: string;
    source_platform: string;
    content_id: string;
    content_url: string;
    content_type: string;
    title: string;
    author_name: string;
    cover_url: string;
    body_text: string;
    recommendation_id: number | null;
    occurred_at: string;
    context: string;
    restored: boolean;
    contexts: Array<{
        context: string;
        occurred_at: string;
        restored: boolean;
    }>;
}
/** One pending dialogue confirmation (hypothesis/confusion). */
export interface PendingConfirmation {
    ref: string;
    kind: string;
    title: string;
    confidence: number;
    evidence: string[];
    status: string;
    /** Confusion items: what the system observed and how it reads it. */
    observation: string;
    interpretation: string;
}
/** Full profile summary (canonical surface fields). */
/** One recent cognition update (profile tab, popup parity). */
export interface CognitionUpdate {
    summary: string;
    context_line: string;
    impact: string;
    reasoning: string;
    evidence: string;
    source: string;
    source_label: string;
    expand_hint: string;
    created_at: string;
}
export interface ProfileSummary {
    initialized: boolean;
    personality_portrait: string;
    core_traits: string[];
    deep_needs: string[];
    mbti: {
        type: string;
        confidence: number;
        dimensions?: Record<string, {
            pole: string;
            strength: number;
        }>;
    };
    values: string[];
    motivational_drivers: string[];
    likes: Array<{
        domain: string;
        weight: number;
        specifics: Array<{
            name: string;
            weight: number;
        }>;
    }>;
    dislikes: Array<{
        domain: string;
        weight: number;
        specifics: Array<{
            name: string;
            weight: number;
        }>;
    }>;
    favorite_up_users: string[];
    life_stage: string;
    current_phase: string;
    cognitive_style: string[];
    exploration_openness: number;
    style: {
        preferred_duration: string;
        preferred_pace: string;
        quality_sensitivity: number;
        humor_preference: number;
        depth_preference: number;
    };
    context: {
        weekday_patterns: string;
        weekend_patterns: string;
        time_of_day_patterns: string;
        session_type: string;
    };
    speculative_interests: Array<{
        domain: string;
        reason: string;
        confidence: number;
        status: string;
        specifics: unknown[];
        confirmation_count: number;
        confirmation_threshold: number;
        probe_mode?: string;
        challenge?: boolean;
    }>;
    speculative_avoidances: Array<{
        domain: string;
        reason: string;
        confidence: number;
        status: string;
        specifics: unknown[];
        confirmation_count: number;
        confirmation_threshold: number;
    }>;
    recent_cognition_updates: CognitionUpdate[];
    has_more_cognition_updates: boolean;
    next_cognition_cursor: string;
    active_insights: Array<{
        hypothesis: string;
        evidence: string[];
        confidence: number;
        validated: boolean;
        created_at?: string;
    }>;
    recent_awareness: Array<{
        date: string;
        observation: string;
        trend: string;
        emotion_guess: string;
    }>;
    overrides: Record<string, unknown>;
}
/** One activity feed item. */
export interface ActivityItem {
    id?: string;
    kind?: string;
    summary?: string;
    occurred_at?: string;
    [key: string]: unknown;
}
/** Runtime status (defensive subset). */
export interface RuntimeStatus {
    initialized: boolean;
    recommendation_count: number;
    unread_count: number;
    last_refresh_at: string;
    pool_available_count: number;
    pool_target_count: number;
    pool_pending_count: number;
    last_replenished_count: number;
    last_discovered_count: number;
    recent_pool_topics: string[];
    manual_refresh_state: string;
    [key: string]: unknown;
}
/** Request error carrying the HTTP status and server detail. */
export declare class ApiError extends Error {
    readonly status: number;
    readonly detail: unknown;
    constructor(path: string, status: number, detail: unknown);
}
/** One raw JSON request against the OpenBiliClaw backend. */
export declare function requestJson(base: string, path: string, options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
    signal?: AbortSignal;
}): Promise<unknown>;
/** GET /api/recommendations — the current recommendation snapshot. */
export declare function fetchRecommendations(base: string, signal?: AbortSignal): Promise<RecommendationItem[]>;
/** POST /api/recommendations/reshuffle — replace the current page. */
export declare function reshuffleRecommendations(base: string, opts?: {
    sourcePlatform?: string;
    excludedBvids?: string[];
}, signal?: AbortSignal): Promise<RecommendationItem[]>;
/** POST /api/recommendations/append — append another page. */
export declare function appendRecommendations(base: string, opts?: {
    sourcePlatform?: string;
    excludedBvids?: string[];
}, signal?: AbortSignal): Promise<RecommendationItem[]>;
/** POST /api/recommendation-click — record a click-through (stable request_id). */
export declare function reportClick(base: string, payload: {
    recommendation_id?: number;
    content_id?: string;
    bvid?: string;
    content_url?: string;
    source_platform?: string;
    title?: string;
    request_id: string;
}, signal?: AbortSignal): Promise<void>;
/** POST /api/feedback — durable card feedback (stable request_id). */
export declare function submitFeedback(base: string, payload: {
    recommendation_id: number;
    feedback_type: string;
    note?: string;
    request_id: string;
}, signal?: AbortSignal): Promise<void>;
/** One raw behavior event (service-worker batch item). */
export interface BehaviorEvent {
    type: string;
    url?: string;
    title?: string;
    timestamp: number;
    source_platform?: string;
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    event_id: string;
    watch_seconds?: number;
    video_duration_seconds?: number;
}
/** POST /api/events — ingest behavior events (e.g. saved-card feedback). */
export declare function sendBehaviorEvents(base: string, events: BehaviorEvent[], signal?: AbortSignal): Promise<{
    accepted: number;
    rejected: Array<{
        index: number;
        type: string;
        reason: string;
    }>;
}>;
/** GET /api/delight/pending-batch — the full un-notified delight queue. */
export declare function fetchDelightBatch(base: string, signal?: AbortSignal): Promise<DelightItem[]>;
/** GET /api/notifications/pending — one notification-worthy recommendation. */
export declare function fetchPendingNotification(base: string, signal?: AbortSignal): Promise<{
    recommendation_id: number;
    bvid: string;
    title: string;
    reason: string;
} | null>;
/** POST /api/delight/respond — view/like/dislike/dismiss/chat (stable request_id). */
export declare function respondToDelight(base: string, payload: {
    bvid: string;
    response: string;
    title?: string;
    message?: string;
    request_id: string;
}, signal?: AbortSignal): Promise<unknown>;
/** GET /api/interest-probes/pending — active speculative interests. */
export declare function fetchInterestProbes(base: string, signal?: AbortSignal): Promise<ProbeItem[]>;
/** POST /api/interest-probes/respond — confirm/reject/defer/chat. */
export declare function respondInterestProbe(base: string, payload: {
    domain: string;
    response: string;
    message?: string;
}, signal?: AbortSignal): Promise<unknown>;
/** GET /api/avoidance-probes/pending — active speculative avoidances. */
export declare function fetchAvoidanceProbes(base: string, signal?: AbortSignal): Promise<ProbeItem[]>;
/** POST /api/avoidance-probes/respond — confirm/reject/defer/chat. */
export declare function respondAvoidanceProbe(base: string, payload: {
    domain: string;
    response: string;
    message?: string;
}, signal?: AbortSignal): Promise<unknown>;
/** POST /api/chat — one Socratic dialogue exchange (returns { reply }). */
export declare function sendChat(base: string, message: string, signal?: AbortSignal): Promise<{
    reply: string;
}>;
/** GET /api/chat/turns — durable dialogue history. */
export declare function fetchChatTurns(base: string, session?: string, signal?: AbortSignal): Promise<ChatTurn[]>;
/** POST /api/chat/turns — start one durable dialogue turn (returns the pending turn). */
export declare function startChatTurn(base: string, message: string, session?: string, replyToTurnId?: string, signal?: AbortSignal): Promise<ChatTurn>;
/** GET /api/chat/turns/{turn_id} — poll one durable turn until it settles. */
export declare function fetchChatTurn(base: string, turnId: string, signal?: AbortSignal): Promise<ChatTurn>;
/** GET /api/chat/pending-confirmations — hypotheses/confusions waiting for the user. */
export declare function fetchPendingConfirmations(base: string, signal?: AbortSignal): Promise<{
    count: number;
    items: PendingConfirmation[];
}>;
/** POST /api/chat/pending-confirmations/{ref}/open — turn a confirmation into a chat turn. */
export declare function openPendingConfirmation(base: string, ref: string, signal?: AbortSignal): Promise<ChatTurn>;
/** POST /api/chat/cards/{turn_id}/action — confirm/reject/discuss/defer a hypothesis card.
 *  Returns the settlement response (state/verdict are authoritative). */
export declare function actOnChatCard(base: string, turnId: string, action: string, signal?: AbortSignal): Promise<unknown>;
/** GET /api/content-history — one paginated 30-day history category. */
export declare function fetchContentHistory(base: string, category: 'clicked' | 'shown' | 'removed', cursor?: string, signal?: AbortSignal): Promise<{
    items: ContentHistoryItem[];
    total: number;
    hasMore: boolean;
    nextCursor: string;
    retentionDays: number;
}>;
/** GET /api/saved/{listKind}/status — saved state for one item (toggle display). */
export declare function fetchSavedStatus(base: string, listKind: 'favorite' | 'watch_later', itemKey: string, signal?: AbortSignal): Promise<boolean>;
/** GET /api/saved/{listKind} — favorite or watch_later memberships plus total. */
export declare function fetchSaved(base: string, listKind: 'favorite' | 'watch_later', signal?: AbortSignal): Promise<SavedListPage>;
/** POST /api/saved/{listKind}/sync — explicit full/batch native sync.
 *  An empty item_keys array means all eligible rows for this list. */
export declare function syncSavedItems(base: string, listKind: 'favorite' | 'watch_later', itemKeys?: string[], signal?: AbortSignal): Promise<SavedSyncBatch>;
/** GET /api/saved-sync/tasks/{task_id} — poll one durable native-sync batch. */
export declare function pollSavedSyncTask(base: string, taskId: string, signal?: AbortSignal): Promise<SavedSyncBatch>;
/** POST /api/saved/{listKind} — add one membership. */
export declare function saveItem(base: string, listKind: 'favorite' | 'watch_later', payload: {
    source_platform: string;
    content_id: string;
    content_url?: string;
    content_type?: string;
    title?: string;
    author_name?: string;
    cover_url?: string;
}, signal?: AbortSignal): Promise<void>;
/** POST /api/saved/{listKind}/remove — remove one membership. */
export declare function removeSaved(base: string, listKind: 'favorite' | 'watch_later', itemKey: string, signal?: AbortSignal): Promise<void>;
/** GET /api/config — the full backend config (masked secrets). */
export declare function fetchConfig(base: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
/** PUT /api/config — partial update; only provided fields are modified and
 *  the backend persists + hot-reloads. */
export declare function updateConfig(base: string, partial: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
/** GET /api/runtime-status — backend readiness and counts. */
export declare function fetchRuntimeStatus(base: string, signal?: AbortSignal): Promise<RuntimeStatus | null>;
/** GET /api/health — reachability probe. */
export declare function fetchHealth(base: string, signal?: AbortSignal): Promise<boolean>;
/** GET /api/profile-summary — the AI profile summary (canonical surface shape). */
export declare function fetchProfileSummary(base: string, opts?: {
    limit?: number;
    cursor?: string;
    signal?: AbortSignal;
}): Promise<ProfileSummary | null>;
/** GET /api/activity-feed — recent activity entries (cursor pagination). */
export declare function fetchActivityFeed(base: string, opts?: {
    limit?: number;
    before?: string;
}, signal?: AbortSignal): Promise<{
    items: ActivityItem[];
    liveSummary: string;
    headline: string;
    hasMore: boolean;
    nextCursor: string;
}>;
/** Generate one stable idempotency key for a UI action (uuid v4). */
export declare function stableId(): string;
/** Result of one no-write connectivity probe (`POST /api/config/probe-service`). */
export interface ProbeResult {
    ok: boolean;
    provider: string;
    model: string;
    message: string;
    error: string;
    latencyMs: number;
}
/** One v2 LLM instance row as exchanged with `/api/config`. */
export interface LlmInstance {
    name: string;
    provider_type: string;
    enabled: boolean;
    api_key: string;
    model: string;
    base_url: string;
    auth_mode: string;
    api_flavor: string;
    http_referer: string;
    x_title: string;
    reasoning_effort: string;
    num_ctx: number;
}
/** `/api/config/discover-models` response. */
export interface ModelDiscoveryResult {
    ok: boolean;
    models: string[];
    reasoningEfforts: string[];
    error: string;
}
/** `/api/init-status` response (defensive). */
export interface InitStatus {
    initialized: boolean;
    running: boolean;
}
/** `/api/update-status` response (defensive). */
export interface UpdateStatus {
    current_version: string;
    latest_version: string;
    latest_tag: string;
    state: string;
    reason: string;
    last_check_at: string;
    error: string;
    install_mode: string;
}
/** Probe submitted LLM/embedding/proxy settings without saving config.toml. */
export declare function probeConfigService(base: string, kind: 'llm' | 'llm_instance' | 'llm_chain' | 'embedding' | 'network_proxy', config: Record<string, unknown>, instanceId?: string, signal?: AbortSignal): Promise<ProbeResult>;
/** List models for one submitted instance without saving config.toml. */
export declare function discoverConfigModels(base: string, instanceId: string, config: Record<string, unknown>, signal?: AbortSignal): Promise<ModelDiscoveryResult>;
/** Read the LAN password-gate status. */
export declare function fetchAuthStatus(base: string, signal?: AbortSignal): Promise<{
    enabled: boolean;
}>;
/** Enable/disable the LAN password gate (local-only admin surface). */
export declare function setLanAuth(base: string, enabled: boolean, password: string, signal?: AbortSignal): Promise<boolean>;
/** Read boot-autostart state. */
export declare function fetchAutostartStatus(base: string, signal?: AbortSignal): Promise<{
    enabled: boolean;
}>;
/** Apply boot-autostart on/off. */
export declare function applyAutostart(base: string, enabled: boolean, signal?: AbortSignal): Promise<boolean>;
/** Read init status. */
export declare function fetchInitStatus(base: string, signal?: AbortSignal): Promise<InitStatus>;
/** Restart initialization (rebuild profile + discovery pool). */
export declare function startInit(base: string, payload: {
    force?: boolean;
    reset_cognition?: boolean;
}, signal?: AbortSignal): Promise<void>;
/** Read backend update status. */
export declare function fetchUpdateStatus(base: string, signal?: AbortSignal): Promise<UpdateStatus>;
/** Trigger an immediate backend update check. */
export declare function checkBackendUpdate(base: string, signal?: AbortSignal): Promise<unknown>;
/** Start applying a backend update (backend restarts afterwards). */
export declare function applyBackendUpdate(base: string, tag: string, signal?: AbortSignal): Promise<unknown>;
/** GET /api/project-stats — the project summary used by the GitHub star prompt. */
export declare function fetchProjectStats(base: string, signal?: AbortSignal): Promise<{
    githubStars: number;
}>;
//# sourceMappingURL=api.d.ts.map