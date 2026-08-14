/**
 * OpenBiliClaw REST client for the browser half. Talks to the user's local
 * backend directly (CORS is permissive); the base URL is user-configurable
 * and persisted in localStorage. Only user-consumption endpoints are used —
 * nothing crawling/source-management related.
 * @module @openbiliclaw/dsh-plugin
 */
/** localStorage key for the API base URL. */
export const API_BASE_KEY = 'openbiliclaw.apiBase';
/** Default local backend address. */
export const DEFAULT_API_BASE = 'http://127.0.0.1:8420';
/** Read the persisted API base URL (falling back to the default). */
export function readApiBase() {
    try {
        const saved = localStorage.getItem(API_BASE_KEY);
        if (saved !== null && saved.trim() !== '')
            return saved.trim().replace(/\/+$/, '');
    }
    catch {
        // localStorage unavailable (private mode etc.) — use the default.
    }
    return DEFAULT_API_BASE;
}
/** Persist the API base URL. */
export function writeApiBase(base) {
    try {
        localStorage.setItem(API_BASE_KEY, base.trim().replace(/\/+$/, ''));
    }
    catch {
        // ignore persistence failures
    }
}
/**
 * Build a concise human-readable summary from a backend error `detail` so the
 * failure toast shows WHICH field failed validation, not just `failed: 422`.
 * FastAPI wraps validation errors as `{ detail: [{ loc, msg, ... }] }` (or a
 * plain string), so unwrap that envelope and render each entry as `loc.path: msg`.
 */
function summarizeDetail(detail) {
    let value = detail;
    if (typeof value === 'object' && value !== null && 'detail' in value) {
        value = value.detail;
    }
    if (typeof value === 'string') {
        return value.trim() === '' ? '' : value.trim();
    }
    if (Array.isArray(value)) {
        const parts = [];
        for (const entry of value) {
            if (typeof entry !== 'object' || entry === null)
                continue;
            const rec = entry;
            const msg = typeof rec.msg === 'string' ? rec.msg : '';
            if (msg === '')
                continue;
            const loc = Array.isArray(rec.loc)
                ? rec.loc.filter((seg) => typeof seg === 'string').join('.')
                : '';
            parts.push(loc === '' ? msg : `${loc}: ${msg}`);
        }
        return parts.join('; ');
    }
    return '';
}
/** Request error carrying the HTTP status and server detail. */
export class ApiError extends Error {
    status;
    detail;
    constructor(path, status, detail) {
        const summary = summarizeDetail(detail);
        super(`${path} failed: ${status}${summary === '' ? '' : ` — ${summary}`}`);
        this.status = status;
        this.detail = detail;
    }
}
/** Minimal timeout helper: AbortController + cleanup. */
function withTimeout(ms, outer) {
    if (ms <= 0)
        return { cleanup() { } };
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    if (outer !== undefined) {
        if (outer.aborted)
            controller.abort();
        else
            outer.addEventListener('abort', onOuterAbort, { once: true });
    }
    const timer = window.setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        cleanup() {
            window.clearTimeout(timer);
            outer?.removeEventListener('abort', onOuterAbort);
        },
    };
}
/** One raw JSON request against the OpenBiliClaw backend. */
export async function requestJson(base, path, options = {}) {
    const { method = 'GET', body, headers, timeoutMs = 15_000, signal } = options;
    const timeout = withTimeout(timeoutMs, signal);
    try {
        const res = await fetch(`${base}${path}`, {
            method,
            credentials: 'omit',
            signal: timeout.signal,
            headers: body === undefined && headers === undefined ? undefined : { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) {
            let detail = null;
            try {
                detail = await res.json();
            }
            catch {
                detail = null;
            }
            throw new ApiError(path, res.status, detail);
        }
        return res.json();
    }
    finally {
        timeout.cleanup();
    }
}
function asItems(value) {
    if (typeof value !== 'object' || value === null)
        return [];
    const items = value.items;
    return Array.isArray(items) ? items : [];
}
function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
/** Decode the HTML entities the crawler occasionally leaves in text fields
 *  (e.g. `&gt;&gt;&gt;`); `&amp;` is decoded last so double-escaped text unwraps once. */
function decodeEntities(value) {
    if (value.indexOf('&') === -1)
        return value;
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}
function str(value) {
    return typeof value === 'string' ? decodeEntities(value) : '';
}
/** Defensive coercion of one recommendation row. */
function toRecommendation(row) {
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
    };
}
/** Defensive coercion of one delight row. */
function toDelight(row) {
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
    };
}
/** Defensive coercion of one probe row. */
function toProbe(row) {
    return {
        domain: str(row.domain),
        reason: str(row.reason),
        confidence: num(row.confidence),
        status: str(row.status),
        probe_mode: str(row.probe_mode),
        challenge: str(row.challenge),
    };
}
/** Defensive coercion of one saved row. */
function toSaved(row) {
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
        sync_task_id: str(row.sync_task_id),
        requested_action: str(row.requested_action),
        resolved_action: str(row.resolved_action),
        resolved_target: str(row.resolved_target),
        error_code: str(row.error_code),
        error_message: str(row.error_message),
    };
}
/** Defensive coercion of one saved-sync result row. */
function toSyncItem(row) {
    return {
        item_key: str(row.item_key),
        status: str(row.status),
        resolved_action: str(row.resolved_action),
        resolved_target: str(row.resolved_target),
        error_code: str(row.error_code),
        error_message: str(row.error_message),
    };
}
// ── Endpoints (user-consumption surface only) ───────────────────────────────
/** GET /api/recommendations — the current recommendation snapshot. */
export async function fetchRecommendations(base, signal) {
    const data = await requestJson(base, '/api/recommendations', { timeoutMs: 20_000, signal });
    return asItems(data).map(toRecommendation);
}
/** POST /api/recommendations/reshuffle — replace the current page. */
export async function reshuffleRecommendations(base, opts = {}, signal) {
    const body = {};
    if (opts.sourcePlatform !== undefined && opts.sourcePlatform !== '')
        body.source_platform = opts.sourcePlatform;
    if (opts.excludedBvids !== undefined && opts.excludedBvids.length > 0)
        body.excluded_bvids = opts.excludedBvids;
    const data = await requestJson(base, '/api/recommendations/reshuffle', { method: 'POST', body, timeoutMs: 20_000, signal });
    return asItems(data).map(toRecommendation);
}
/** POST /api/recommendations/append — append another page. */
export async function appendRecommendations(base, opts = {}, signal) {
    const body = {};
    if (opts.sourcePlatform !== undefined && opts.sourcePlatform !== '')
        body.source_platform = opts.sourcePlatform;
    if (opts.excludedBvids !== undefined && opts.excludedBvids.length > 0)
        body.excluded_bvids = opts.excludedBvids;
    const data = await requestJson(base, '/api/recommendations/append', { method: 'POST', body, timeoutMs: 20_000, signal });
    return asItems(data).map(toRecommendation);
}
/** POST /api/recommendation-click — record a click-through (stable request_id). */
export async function reportClick(base, payload, signal) {
    await requestJson(base, '/api/recommendation-click', { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal });
}
/** POST /api/feedback — durable card feedback (stable request_id). */
export async function submitFeedback(base, payload, signal) {
    await requestJson(base, '/api/feedback', { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal });
}
/** GET /api/delight/pending-batch — the full un-notified delight queue. */
export async function fetchDelightBatch(base, signal) {
    const data = await requestJson(base, '/api/delight/pending-batch?limit=20', { timeoutMs: 15_000, signal });
    return asItems(data).map(toDelight);
}
/** GET /api/notifications/pending — one notification-worthy recommendation. */
export async function fetchPendingNotification(base, signal) {
    try {
        const data = await requestJson(base, '/api/notifications/pending', { timeoutMs: 8_000, signal });
        if (typeof data !== 'object' || data === null)
            return null;
        const row = data.item;
        if (typeof row !== 'object' || row === null)
            return null;
        const item = row;
        return {
            recommendation_id: num(item.recommendation_id),
            bvid: str(item.bvid),
            title: str(item.title),
            reason: str(item.reason),
        };
    }
    catch {
        return null;
    }
}
/** POST /api/delight/respond — view/like/dislike/dismiss/chat (stable request_id). */
export async function respondToDelight(base, payload, signal) {
    return requestJson(base, '/api/delight/respond', { method: 'POST', body: { ...payload }, timeoutMs: 20_000, signal });
}
/** GET /api/interest-probes/pending — active speculative interests. */
export async function fetchInterestProbes(base, signal) {
    const data = await requestJson(base, '/api/interest-probes/pending', { timeoutMs: 10_000, signal });
    return asItems(data).map(toProbe);
}
/** POST /api/interest-probes/respond — confirm/reject/defer/chat. */
export async function respondInterestProbe(base, payload, signal) {
    const body = { domain: payload.domain, response: payload.response };
    if (payload.message !== undefined && payload.message !== '')
        body.message = payload.message;
    return requestJson(base, '/api/interest-probes/respond', { method: 'POST', body, timeoutMs: 20_000, signal });
}
/** GET /api/avoidance-probes/pending — active speculative avoidances. */
export async function fetchAvoidanceProbes(base, signal) {
    const data = await requestJson(base, '/api/avoidance-probes/pending', { timeoutMs: 10_000, signal });
    return asItems(data).map(toProbe);
}
/** POST /api/avoidance-probes/respond — confirm/reject/defer/chat. */
export async function respondAvoidanceProbe(base, payload, signal) {
    const body = { domain: payload.domain, response: payload.response };
    if (payload.message !== undefined && payload.message !== '')
        body.message = payload.message;
    return requestJson(base, '/api/avoidance-probes/respond', { method: 'POST', body, timeoutMs: 20_000, signal });
}
/** POST /api/chat — one Socratic dialogue exchange (returns { reply }). */
export async function sendChat(base, message, signal) {
    const data = await requestJson(base, '/api/chat', { method: 'POST', body: { message }, timeoutMs: 300_000, signal });
    const reply = typeof data === 'object' && data !== null ? str(data.reply) : '';
    return { reply };
}
/** Defensive coercion of one chat turn row. */
function toChatTurn(row) {
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
        payload: typeof row.payload === 'object' && row.payload !== null ? row.payload : undefined,
    };
}
/** GET /api/chat/turns — durable dialogue history. */
export async function fetchChatTurns(base, session = 'dsh', signal) {
    const data = await requestJson(base, `/api/chat/turns?session=${encodeURIComponent(session)}&limit=50`, { timeoutMs: 10_000, signal });
    return asItems(data).map(toChatTurn);
}
/** POST /api/chat/turns — start one durable dialogue turn (returns the pending turn). */
export async function startChatTurn(base, message, session = 'dsh', replyToTurnId, signal) {
    const body = { session, scope: 'chat', message };
    if (replyToTurnId !== undefined && replyToTurnId !== '')
        body.reply_to_turn_id = replyToTurnId;
    const data = await requestJson(base, '/api/chat/turns', {
        method: 'POST',
        body,
        timeoutMs: 20_000,
        signal,
    });
    if (typeof data !== 'object' || data === null)
        throw new Error('chat/turns: unexpected response');
    return toChatTurn(data);
}
/** GET /api/chat/turns/{turn_id} — poll one durable turn until it settles. */
export async function fetchChatTurn(base, turnId, signal) {
    const data = await requestJson(base, `/api/chat/turns/${encodeURIComponent(turnId)}`, { timeoutMs: 15_000, signal });
    if (typeof data !== 'object' || data === null)
        throw new Error('chat/turns: unexpected response');
    return toChatTurn(data);
}
/** GET /api/chat/pending-confirmations — hypotheses/confusions waiting for the user. */
export async function fetchPendingConfirmations(base, signal) {
    const data = await requestJson(base, '/api/chat/pending-confirmations', { timeoutMs: 10_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    const items = Array.isArray(row.items) ? row.items : [];
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
    };
}
/** POST /api/chat/pending-confirmations/{ref}/open — turn a confirmation into a chat turn. */
export async function openPendingConfirmation(base, ref, signal) {
    const data = await requestJson(base, `/api/chat/pending-confirmations/${encodeURIComponent(ref)}/open`, {
        method: 'POST',
        body: { session: 'dsh' },
        timeoutMs: 20_000,
        signal,
    });
    if (typeof data !== 'object' || data === null)
        throw new Error('pending-confirmations/open: unexpected response');
    return toChatTurn(data);
}
/** POST /api/chat/cards/{turn_id}/action — confirm/reject/discuss/defer a hypothesis card.
 *  Returns the settlement response (state/verdict are authoritative). */
export async function actOnChatCard(base, turnId, action, signal) {
    return requestJson(base, `/api/chat/cards/${encodeURIComponent(turnId)}/action`, {
        method: 'POST',
        body: { action },
        timeoutMs: 20_000,
        signal,
    });
}
/** GET /api/content-history — one paginated 30-day history category. */
export async function fetchContentHistory(base, category, cursor = '', signal) {
    const params = new URLSearchParams({ category, limit: '12' });
    if (cursor !== '')
        params.set('cursor', cursor);
    const data = await requestJson(base, `/api/content-history?${params.toString()}`, { timeoutMs: 15_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return {
        items: (Array.isArray(row.items) ? row.items : []).map(item => ({
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
                ? item.contexts.map(ctx => ({
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
    };
}
/** GET /api/saved/{listKind}/status — saved state for one item (toggle display). */
export async function fetchSavedStatus(base, listKind, itemKey, signal) {
    const data = await requestJson(base, `/api/saved/${listKind}/status?item_key=${encodeURIComponent(itemKey)}`, { timeoutMs: 8_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return row.saved === true;
}
/** GET /api/saved/{listKind} — favorite or watch_later memberships plus total. */
export async function fetchSaved(base, listKind, signal) {
    const data = await requestJson(base, `/api/saved/${listKind}`, { timeoutMs: 10_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return { items: asItems(data).map(toSaved), total: num(row.total) };
}
/** POST /api/saved/{listKind}/sync — explicit full/batch native sync.
 *  An empty item_keys array means all eligible rows for this list. */
export async function syncSavedItems(base, listKind, itemKeys = [], signal) {
    const data = await requestJson(base, `/api/saved/${listKind}/sync`, {
        method: 'POST',
        body: { item_keys: itemKeys.map(key => key.trim()).filter(key => key !== '') },
        timeoutMs: 20_000,
        signal,
    });
    return toSyncBatch(data);
}
/** GET /api/saved-sync/tasks/{task_id} — poll one durable native-sync batch. */
export async function pollSavedSyncTask(base, taskId, signal) {
    const data = await requestJson(base, `/api/saved-sync/tasks/${encodeURIComponent(taskId.trim())}`, { timeoutMs: 15_000, signal });
    return toSyncBatch(data);
}
function toSyncBatch(data) {
    const row = typeof data === 'object' && data !== null ? data : {};
    return {
        task_id: str(row.task_id),
        items: (Array.isArray(row.items) ? row.items : []).map(toSyncItem),
    };
}
/** POST /api/saved/{listKind} — add one membership. */
export async function saveItem(base, listKind, payload, signal) {
    await requestJson(base, `/api/saved/${listKind}`, { method: 'POST', body: { ...payload }, timeoutMs: 10_000, signal });
}
/** POST /api/saved/{listKind}/remove — remove one membership. */
export async function removeSaved(base, listKind, itemKey, signal) {
    await requestJson(base, `/api/saved/${listKind}/remove`, { method: 'POST', body: { item_key: itemKey }, timeoutMs: 10_000, signal });
}
/** GET /api/config — the full backend config (masked secrets). */
export async function fetchConfig(base, signal) {
    const data = await requestJson(base, '/api/config', { timeoutMs: 15_000, signal });
    return typeof data === 'object' && data !== null ? data : {};
}
/** PUT /api/config — partial update; only provided fields are modified and
 *  the backend persists + hot-reloads. */
export async function updateConfig(base, partial, signal) {
    return requestJson(base, '/api/config', { method: 'PUT', body: partial, timeoutMs: 30_000, signal });
}
/** GET /api/runtime-status — backend readiness and counts. */
export async function fetchRuntimeStatus(base, signal) {
    try {
        const data = await requestJson(base, '/api/runtime-status', { timeoutMs: 8_000, signal });
        if (typeof data !== 'object' || data === null)
            return null;
        const row = data;
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
        };
    }
    catch {
        return null;
    }
}
/** GET /api/health — reachability probe. */
export async function fetchHealth(base, signal) {
    try {
        const data = await requestJson(base, '/api/health', { timeoutMs: 5_000, signal });
        return typeof data === 'object' && data !== null && data.status === 'ok';
    }
    catch {
        return false;
    }
}
/** GET /api/profile-summary — the AI profile summary (canonical surface shape). */
export async function fetchProfileSummary(base, signal) {
    try {
        const data = await requestJson(base, '/api/profile-summary?limit=5', { timeoutMs: 10_000, signal });
        if (typeof data !== 'object' || data === null)
            return null;
        const row = data;
        const mbti = typeof row.mbti === 'object' && row.mbti !== null ? row.mbti : {};
        const toDomain = (raw) => {
            if (typeof raw !== 'object' || raw === null)
                return { domain: '', weight: 0, specifics: [] };
            const d = raw;
            return {
                domain: str(d.domain),
                weight: num(d.weight),
                specifics: Array.isArray(d.specifics)
                    ? d.specifics.map(s => ({ name: str(s.name), weight: num(s.weight) }))
                    : [],
            };
        };
        const toProbe = (raw) => {
            if (typeof raw !== 'object' || raw === null)
                return null;
            const p = raw;
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
            };
        };
        return {
            initialized: row.initialized === true,
            personality_portrait: str(row.personality_portrait),
            core_traits: Array.isArray(row.core_traits) ? row.core_traits.map(String) : [],
            deep_needs: Array.isArray(row.deep_needs) ? row.deep_needs.map(String) : [],
            mbti: {
                type: str(mbti.type),
                confidence: num(mbti.confidence),
                dimensions: typeof mbti.dimensions === 'object' && mbti.dimensions !== null
                    ? mbti.dimensions
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
                const s = typeof row.style === 'object' && row.style !== null ? row.style : {};
                return {
                    preferred_duration: str(s.preferred_duration),
                    preferred_pace: str(s.preferred_pace),
                    quality_sensitivity: num(s.quality_sensitivity),
                    humor_preference: num(s.humor_preference),
                    depth_preference: num(s.depth_preference),
                };
            })(),
            context: (() => {
                const c = typeof row.context === 'object' && row.context !== null ? row.context : {};
                return {
                    weekday_patterns: str(c.weekday_patterns),
                    weekend_patterns: str(c.weekend_patterns),
                    time_of_day_patterns: str(c.time_of_day_patterns),
                    session_type: str(c.session_type),
                };
            })(),
            speculative_interests: Array.isArray(row.speculative_interests) ? row.speculative_interests.map(toProbe).filter((p) => p !== null) : [],
            speculative_avoidances: Array.isArray(row.speculative_avoidances) ? row.speculative_avoidances.map(toProbe).filter((p) => p !== null) : [],
            active_insights: Array.isArray(row.active_insights)
                ? row.active_insights.map(i => ({
                    hypothesis: str(i.hypothesis),
                    evidence: Array.isArray(i.evidence) ? i.evidence.map(String) : [],
                    confidence: num(i.confidence),
                    validated: i.validated === true,
                    created_at: str(i.created_at),
                }))
                : [],
            recent_awareness: Array.isArray(row.recent_awareness)
                ? row.recent_awareness.map(a => ({
                    date: str(a.date),
                    observation: str(a.observation),
                    trend: str(a.trend),
                    emotion_guess: str(a.emotion_guess),
                }))
                : [],
        };
    }
    catch {
        return null;
    }
}
/** GET /api/activity-feed — recent activity entries (cursor pagination). */
export async function fetchActivityFeed(base, opts = {}, signal) {
    const params = new URLSearchParams();
    if (opts.limit !== undefined)
        params.set('limit', String(Math.max(1, Math.min(100, opts.limit))));
    if (opts.before !== undefined && opts.before !== '')
        params.set('before', opts.before);
    const qs = params.toString();
    const data = await requestJson(base, `/api/activity-feed${qs !== '' ? `?${qs}` : ''}`, { timeoutMs: 10_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return {
        items: asItems(data),
        liveSummary: str(row.live_summary),
        headline: str(row.headline),
        hasMore: row.has_more === true,
        nextCursor: str(row.next_cursor),
    };
}
/** Generate one stable idempotency key for a UI action (uuid v4). */
export function stableId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** Probe submitted LLM/embedding/proxy settings without saving config.toml. */
export async function probeConfigService(base, kind, config, instanceId = '', signal) {
    const data = await requestJson(base, '/api/config/probe-service', {
        method: 'POST',
        timeoutMs: 60_000,
        signal,
        body: { kind, instance_id: instanceId, config },
    });
    const row = typeof data === 'object' && data !== null ? data : {};
    return {
        ok: row.ok === true,
        provider: str(row.provider),
        model: str(row.model),
        message: str(row.message),
        error: str(row.error),
        latencyMs: num(row.latency_ms),
    };
}
/** List models for one submitted instance without saving config.toml. */
export async function discoverConfigModels(base, instanceId, config, signal) {
    const data = await requestJson(base, '/api/config/discover-models', {
        method: 'POST',
        timeoutMs: 60_000,
        signal,
        body: { instance_id: instanceId, config },
    });
    const row = typeof data === 'object' && data !== null ? data : {};
    const models = Array.isArray(row.models) ? row.models.map(item => String(item)) : [];
    const reasoningEfforts = Array.isArray(row.reasoning_efforts) ? row.reasoning_efforts.map(item => String(item)) : [];
    return {
        ok: row.ok === true,
        models,
        reasoningEfforts,
        error: str(row.error),
    };
}
/** Read the LAN password-gate status. */
export async function fetchAuthStatus(base, signal) {
    const data = await requestJson(base, '/api/auth/status', { timeoutMs: 10_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return { enabled: row.enabled === true };
}
/** Enable/disable the LAN password gate (local-only admin surface). */
export async function setLanAuth(base, enabled, password, signal) {
    const data = await requestJson(base, '/api/auth/admin', {
        method: 'POST',
        timeoutMs: 15_000,
        signal,
        headers: { 'X-OBC-Auth': '1' },
        body: enabled ? { enabled: true, password } : { enabled: false },
    });
    const row = typeof data === 'object' && data !== null ? data : {};
    return row.ok === true;
}
/** Read boot-autostart state. */
export async function fetchAutostartStatus(base, signal) {
    const data = await requestJson(base, '/api/autostart-status', { timeoutMs: 10_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return { enabled: row.enabled === true };
}
/** Apply boot-autostart on/off. */
export async function applyAutostart(base, enabled, signal) {
    const data = await requestJson(base, '/api/autostart/apply', {
        method: 'POST',
        timeoutMs: 15_000,
        signal,
        headers: { 'X-OBC-Auth': '1' },
        body: { enabled: Boolean(enabled) },
    });
    const row = typeof data === 'object' && data !== null ? data : {};
    return row.ok === true || row.enabled === enabled;
}
/** Read init status. */
export async function fetchInitStatus(base, signal) {
    const data = await requestJson(base, '/api/init-status', { timeoutMs: 45_000, signal });
    const row = typeof data === 'object' && data !== null ? data : {};
    return { initialized: row.initialized === true, running: row.running === true };
}
/** Restart initialization (rebuild profile + discovery pool). */
export async function startInit(base, payload, signal) {
    await requestJson(base, '/api/init', { method: 'POST', timeoutMs: 60_000, signal, body: payload });
}
/** Read backend update status. */
export async function fetchUpdateStatus(base, signal) {
    const asDict = (value) => typeof value === 'object' && value !== null ? value : {};
    const data = await requestJson(base, '/api/update-status', { timeoutMs: 10_000, signal });
    const root = asDict(data);
    const row = Object.keys(asDict(root.backend)).length > 0 ? asDict(root.backend) : root;
    return {
        current_version: str(row.current_version),
        latest_version: str(row.latest_version),
        latest_tag: str(row.latest_tag),
        state: str(row.state),
        reason: str(row.reason),
        last_check_at: str(row.last_check_at),
        error: str(row.last_error),
        install_mode: str(row.install_mode),
    };
}
/** Trigger an immediate backend update check. */
export async function checkBackendUpdate(base, signal) {
    return requestJson(base, '/api/update/check', {
        method: 'POST', timeoutMs: 60_000, signal, body: { include_backend: true },
    });
}
/** Start applying a backend update (backend restarts afterwards). */
export async function applyBackendUpdate(base, tag, signal) {
    return requestJson(base, '/api/update/apply', {
        method: 'POST', timeoutMs: 60_000, signal, body: { target: 'backend', tag },
    });
}
/** GET /api/project-stats — the project summary used by the GitHub star prompt. */
export async function fetchProjectStats(base, signal) {
    try {
        const data = await requestJson(base, '/api/project-stats', { timeoutMs: 6000, signal });
        const row = typeof data === 'object' && data !== null ? data : {};
        const n = Number(row.github_stars);
        return { githubStars: Number.isFinite(n) ? n : 0 };
    }
    catch {
        return { githubStars: 0 };
    }
}
//# sourceMappingURL=api.js.map