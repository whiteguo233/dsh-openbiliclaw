window.__ModuleLoader__.load({
	id: "@openbiliclaw/dsh-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region lib/types/client/api.js
		/**
		* OpenBiliClaw REST client for the browser half. Talks to the user's local
		* backend directly (CORS is permissive); the base URL is user-configurable
		* and persisted in localStorage. Only user-consumption endpoints are used —
		* nothing crawling/source-management related.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** localStorage key for the API base URL. */
		const API_BASE_KEY = "openbiliclaw.apiBase";
		/** Default local backend address. */
		const DEFAULT_API_BASE = "http://127.0.0.1:8420";
		/** Read the persisted API base URL (falling back to the default). */
		function readApiBase() {
			try {
				const saved = localStorage.getItem(API_BASE_KEY);
				if (saved !== null && saved.trim() !== "") return saved.trim().replace(/\/+$/, "");
			} catch {}
			return DEFAULT_API_BASE;
		}
		/** Persist the API base URL. */
		function writeApiBase(base) {
			try {
				localStorage.setItem(API_BASE_KEY, base.trim().replace(/\/+$/, ""));
			} catch {}
		}
		/** Request error carrying the HTTP status and server detail. */
		var ApiError = class extends Error {
			status;
			detail;
			constructor(path, status, detail) {
				super(`${path} failed: ${status}`);
				this.status = status;
				this.detail = detail;
			}
		};
		/** Minimal timeout helper: AbortController + cleanup. */
		function withTimeout(ms, outer) {
			if (ms <= 0) return { cleanup() {} };
			const controller = new AbortController();
			const onOuterAbort = () => controller.abort();
			if (outer !== void 0) if (outer.aborted) controller.abort();
			else outer.addEventListener("abort", onOuterAbort, { once: true });
			const timer = window.setTimeout(() => controller.abort(), ms);
			return {
				signal: controller.signal,
				cleanup() {
					window.clearTimeout(timer);
					outer?.removeEventListener("abort", onOuterAbort);
				}
			};
		}
		/** One raw JSON request against the OpenBiliClaw backend. */
		async function requestJson(base, path, options = {}) {
			const { method = "GET", body, headers, timeoutMs = 15e3, signal } = options;
			const timeout = withTimeout(timeoutMs, signal);
			try {
				const res = await fetch(`${base}${path}`, {
					method,
					credentials: "omit",
					signal: timeout.signal,
					headers: body === void 0 && headers === void 0 ? void 0 : {
						...body === void 0 ? {} : { "Content-Type": "application/json" },
						...headers
					},
					body: body === void 0 ? void 0 : JSON.stringify(body)
				});
				if (!res.ok) {
					let detail = null;
					try {
						detail = await res.json();
					} catch {
						detail = null;
					}
					throw new ApiError(path, res.status, detail);
				}
				return res.json();
			} finally {
				timeout.cleanup();
			}
		}
		function asItems(value) {
			if (typeof value !== "object" || value === null) return [];
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
			if (value.indexOf("&") === -1) return value;
			return value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10))).replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
		}
		function str(value) {
			return typeof value === "string" ? decodeEntities(value) : "";
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
				favorite_count: num(row.favorite_count)
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
				state: str(row.state)
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
				challenge: str(row.challenge)
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
				sync_status: str(row.sync_status)
			};
		}
		/** GET /api/recommendations — the current recommendation snapshot. */
		async function fetchRecommendations(base, signal) {
			return asItems(await requestJson(base, "/api/recommendations", {
				timeoutMs: 2e4,
				signal
			})).map(toRecommendation);
		}
		/** POST /api/recommendations/reshuffle — replace the current page. */
		async function reshuffleRecommendations(base, opts = {}, signal) {
			const body = {};
			if (opts.sourcePlatform !== void 0 && opts.sourcePlatform !== "") body.source_platform = opts.sourcePlatform;
			if (opts.excludedBvids !== void 0 && opts.excludedBvids.length > 0) body.excluded_bvids = opts.excludedBvids;
			return asItems(await requestJson(base, "/api/recommendations/reshuffle", {
				method: "POST",
				body,
				timeoutMs: 2e4,
				signal
			})).map(toRecommendation);
		}
		/** POST /api/recommendations/append — append another page. */
		async function appendRecommendations(base, opts = {}, signal) {
			const body = {};
			if (opts.sourcePlatform !== void 0 && opts.sourcePlatform !== "") body.source_platform = opts.sourcePlatform;
			if (opts.excludedBvids !== void 0 && opts.excludedBvids.length > 0) body.excluded_bvids = opts.excludedBvids;
			return asItems(await requestJson(base, "/api/recommendations/append", {
				method: "POST",
				body,
				timeoutMs: 2e4,
				signal
			})).map(toRecommendation);
		}
		/** POST /api/recommendation-click — record a click-through (stable request_id). */
		async function reportClick(base, payload, signal) {
			await requestJson(base, "/api/recommendation-click", {
				method: "POST",
				body: { ...payload },
				timeoutMs: 1e4,
				signal
			});
		}
		/** POST /api/feedback — durable card feedback (stable request_id). */
		async function submitFeedback(base, payload, signal) {
			await requestJson(base, "/api/feedback", {
				method: "POST",
				body: { ...payload },
				timeoutMs: 1e4,
				signal
			});
		}
		/** GET /api/delight/pending-batch — the full un-notified delight queue. */
		async function fetchDelightBatch(base, signal) {
			return asItems(await requestJson(base, "/api/delight/pending-batch?limit=20", {
				timeoutMs: 15e3,
				signal
			})).map(toDelight);
		}
		/** GET /api/notifications/pending — one notification-worthy recommendation. */
		async function fetchPendingNotification(base, signal) {
			try {
				const data = await requestJson(base, "/api/notifications/pending", {
					timeoutMs: 8e3,
					signal
				});
				if (typeof data !== "object" || data === null) return null;
				const row = data.item;
				if (typeof row !== "object" || row === null) return null;
				const item = row;
				return {
					recommendation_id: num(item.recommendation_id),
					bvid: str(item.bvid),
					title: str(item.title),
					reason: str(item.reason)
				};
			} catch {
				return null;
			}
		}
		/** POST /api/delight/respond — view/like/dislike/dismiss/chat (stable request_id). */
		async function respondToDelight(base, payload, signal) {
			return requestJson(base, "/api/delight/respond", {
				method: "POST",
				body: { ...payload },
				timeoutMs: 2e4,
				signal
			});
		}
		/** GET /api/interest-probes/pending — active speculative interests. */
		async function fetchInterestProbes(base, signal) {
			return asItems(await requestJson(base, "/api/interest-probes/pending", {
				timeoutMs: 1e4,
				signal
			})).map(toProbe);
		}
		/** POST /api/interest-probes/respond — confirm/reject/defer/chat. */
		async function respondInterestProbe(base, payload, signal) {
			const body = {
				domain: payload.domain,
				response: payload.response
			};
			if (payload.message !== void 0 && payload.message !== "") body.message = payload.message;
			return requestJson(base, "/api/interest-probes/respond", {
				method: "POST",
				body,
				timeoutMs: 2e4,
				signal
			});
		}
		/** GET /api/avoidance-probes/pending — active speculative avoidances. */
		async function fetchAvoidanceProbes(base, signal) {
			return asItems(await requestJson(base, "/api/avoidance-probes/pending", {
				timeoutMs: 1e4,
				signal
			})).map(toProbe);
		}
		/** POST /api/avoidance-probes/respond — confirm/reject/defer/chat. */
		async function respondAvoidanceProbe(base, payload, signal) {
			const body = {
				domain: payload.domain,
				response: payload.response
			};
			if (payload.message !== void 0 && payload.message !== "") body.message = payload.message;
			return requestJson(base, "/api/avoidance-probes/respond", {
				method: "POST",
				body,
				timeoutMs: 2e4,
				signal
			});
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
				payload: typeof row.payload === "object" && row.payload !== null ? row.payload : void 0
			};
		}
		/** GET /api/chat/turns — durable dialogue history. */
		async function fetchChatTurns(base, session = "dsh", signal) {
			return asItems(await requestJson(base, `/api/chat/turns?session=${encodeURIComponent(session)}&limit=50`, {
				timeoutMs: 1e4,
				signal
			})).map(toChatTurn);
		}
		/** POST /api/chat/turns — start one durable dialogue turn (returns the pending turn). */
		async function startChatTurn(base, message, session = "dsh", replyToTurnId, signal) {
			const body = {
				session,
				scope: "chat",
				message
			};
			if (replyToTurnId !== void 0 && replyToTurnId !== "") body.reply_to_turn_id = replyToTurnId;
			const data = await requestJson(base, "/api/chat/turns", {
				method: "POST",
				body,
				timeoutMs: 2e4,
				signal
			});
			if (typeof data !== "object" || data === null) throw new Error("chat/turns: unexpected response");
			return toChatTurn(data);
		}
		/** GET /api/chat/turns/{turn_id} — poll one durable turn until it settles. */
		async function fetchChatTurn(base, turnId, signal) {
			const data = await requestJson(base, `/api/chat/turns/${encodeURIComponent(turnId)}`, {
				timeoutMs: 15e3,
				signal
			});
			if (typeof data !== "object" || data === null) throw new Error("chat/turns: unexpected response");
			return toChatTurn(data);
		}
		/** GET /api/chat/pending-confirmations — hypotheses/confusions waiting for the user. */
		async function fetchPendingConfirmations(base, signal) {
			const data = await requestJson(base, "/api/chat/pending-confirmations", {
				timeoutMs: 1e4,
				signal
			});
			const row = typeof data === "object" && data !== null ? data : {};
			const items = Array.isArray(row.items) ? row.items : [];
			return {
				count: num(row.count),
				items: items.map((item) => ({
					ref: str(item.ref),
					kind: str(item.kind),
					title: str(item.title ?? item.hypothesis),
					confidence: num(item.confidence),
					evidence: Array.isArray(item.evidence_refs) ? item.evidence_refs.map(String) : [],
					status: str(item.status),
					observation: str(item.observation),
					interpretation: str(item.interpretation)
				}))
			};
		}
		/** POST /api/chat/pending-confirmations/{ref}/open — turn a confirmation into a chat turn. */
		async function openPendingConfirmation(base, ref, signal) {
			const data = await requestJson(base, `/api/chat/pending-confirmations/${encodeURIComponent(ref)}/open`, {
				method: "POST",
				body: { session: "dsh" },
				timeoutMs: 2e4,
				signal
			});
			if (typeof data !== "object" || data === null) throw new Error("pending-confirmations/open: unexpected response");
			return toChatTurn(data);
		}
		/** POST /api/chat/cards/{turn_id}/action — confirm/reject/discuss/defer a hypothesis card.
		*  Returns the settlement response (state/verdict are authoritative). */
		async function actOnChatCard(base, turnId, action, signal) {
			return requestJson(base, `/api/chat/cards/${encodeURIComponent(turnId)}/action`, {
				method: "POST",
				body: { action },
				timeoutMs: 2e4,
				signal
			});
		}
		/** GET /api/content-history — one paginated 30-day history category. */
		async function fetchContentHistory(base, category, cursor = "", signal) {
			const params = new URLSearchParams({
				category,
				limit: "12"
			});
			if (cursor !== "") params.set("cursor", cursor);
			const data = await requestJson(base, `/api/content-history?${params.toString()}`, {
				timeoutMs: 15e3,
				signal
			});
			const row = typeof data === "object" && data !== null ? data : {};
			return {
				items: (Array.isArray(row.items) ? row.items : []).map((item) => ({
					item_key: str(item.item_key),
					source_platform: str(item.source_platform),
					content_id: str(item.content_id),
					content_url: str(item.content_url),
					content_type: str(item.content_type),
					title: str(item.title),
					author_name: str(item.author_name),
					cover_url: str(item.cover_url),
					body_text: str(item.body_text),
					recommendation_id: item.recommendation_id === null || item.recommendation_id === void 0 ? null : num(item.recommendation_id),
					occurred_at: str(item.occurred_at),
					context: str(item.context),
					restored: item.restored === true,
					contexts: Array.isArray(item.contexts) ? item.contexts.map((ctx) => ({
						context: str(ctx.context),
						occurred_at: str(ctx.occurred_at),
						restored: ctx.restored === true
					})) : []
				})),
				total: num(row.total),
				hasMore: row.has_more === true,
				nextCursor: str(row.next_cursor),
				retentionDays: num(row.retention_days)
			};
		}
		/** GET /api/saved/{listKind}/status — saved state for one item (toggle display). */
		async function fetchSavedStatus(base, listKind, itemKey, signal) {
			const data = await requestJson(base, `/api/saved/${listKind}/status?item_key=${encodeURIComponent(itemKey)}`, {
				timeoutMs: 8e3,
				signal
			});
			return (typeof data === "object" && data !== null ? data : {}).saved === true;
		}
		/** GET /api/saved/{listKind} — favorite or watch_later memberships. */
		async function fetchSaved(base, listKind, signal) {
			return asItems(await requestJson(base, `/api/saved/${listKind}`, {
				timeoutMs: 1e4,
				signal
			})).map(toSaved);
		}
		/** POST /api/saved/{listKind} — add one membership. */
		async function saveItem(base, listKind, payload, signal) {
			await requestJson(base, `/api/saved/${listKind}`, {
				method: "POST",
				body: { ...payload },
				timeoutMs: 1e4,
				signal
			});
		}
		/** POST /api/saved/{listKind}/remove — remove one membership. */
		async function removeSaved(base, listKind, itemKey, signal) {
			await requestJson(base, `/api/saved/${listKind}/remove`, {
				method: "POST",
				body: { item_key: itemKey },
				timeoutMs: 1e4,
				signal
			});
		}
		/** GET /api/config — the full backend config (masked secrets). */
		async function fetchConfig(base, signal) {
			const data = await requestJson(base, "/api/config", {
				timeoutMs: 15e3,
				signal
			});
			return typeof data === "object" && data !== null ? data : {};
		}
		/** PUT /api/config — partial update; only provided fields are modified and
		*  the backend persists + hot-reloads. */
		async function updateConfig(base, partial, signal) {
			return requestJson(base, "/api/config", {
				method: "PUT",
				body: partial,
				timeoutMs: 3e4,
				signal
			});
		}
		/** GET /api/runtime-status — backend readiness and counts. */
		async function fetchRuntimeStatus(base, signal) {
			try {
				const data = await requestJson(base, "/api/runtime-status", {
					timeoutMs: 8e3,
					signal
				});
				if (typeof data !== "object" || data === null) return null;
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
					...row
				};
			} catch {
				return null;
			}
		}
		/** GET /api/health — reachability probe. */
		async function fetchHealth(base, signal) {
			try {
				const data = await requestJson(base, "/api/health", {
					timeoutMs: 5e3,
					signal
				});
				return typeof data === "object" && data !== null && data.status === "ok";
			} catch {
				return false;
			}
		}
		/** GET /api/profile-summary — the AI profile summary (canonical surface shape). */
		async function fetchProfileSummary(base, signal) {
			try {
				const data = await requestJson(base, "/api/profile-summary?limit=5", {
					timeoutMs: 1e4,
					signal
				});
				if (typeof data !== "object" || data === null) return null;
				const row = data;
				const mbti = typeof row.mbti === "object" && row.mbti !== null ? row.mbti : {};
				const toDomain = (raw) => {
					if (typeof raw !== "object" || raw === null) return {
						domain: "",
						weight: 0,
						specifics: []
					};
					const d = raw;
					return {
						domain: str(d.domain),
						weight: num(d.weight),
						specifics: Array.isArray(d.specifics) ? d.specifics.map((s) => ({
							name: str(s.name),
							weight: num(s.weight)
						})) : []
					};
				};
				const toProbe = (raw) => {
					if (typeof raw !== "object" || raw === null) return null;
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
						challenge: p.challenge === true
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
						dimensions: typeof mbti.dimensions === "object" && mbti.dimensions !== null ? mbti.dimensions : void 0
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
						const s = typeof row.style === "object" && row.style !== null ? row.style : {};
						return {
							preferred_duration: str(s.preferred_duration),
							preferred_pace: str(s.preferred_pace),
							quality_sensitivity: num(s.quality_sensitivity),
							humor_preference: num(s.humor_preference),
							depth_preference: num(s.depth_preference)
						};
					})(),
					context: (() => {
						const c = typeof row.context === "object" && row.context !== null ? row.context : {};
						return {
							weekday_patterns: str(c.weekday_patterns),
							weekend_patterns: str(c.weekend_patterns),
							time_of_day_patterns: str(c.time_of_day_patterns),
							session_type: str(c.session_type)
						};
					})(),
					speculative_interests: Array.isArray(row.speculative_interests) ? row.speculative_interests.map(toProbe).filter((p) => p !== null) : [],
					speculative_avoidances: Array.isArray(row.speculative_avoidances) ? row.speculative_avoidances.map(toProbe).filter((p) => p !== null) : [],
					active_insights: Array.isArray(row.active_insights) ? row.active_insights.map((i) => ({
						hypothesis: str(i.hypothesis),
						evidence: Array.isArray(i.evidence) ? i.evidence.map(String) : [],
						confidence: num(i.confidence),
						validated: i.validated === true,
						created_at: str(i.created_at)
					})) : [],
					recent_awareness: Array.isArray(row.recent_awareness) ? row.recent_awareness.map((a) => ({
						date: str(a.date),
						observation: str(a.observation),
						trend: str(a.trend),
						emotion_guess: str(a.emotion_guess)
					})) : []
				};
			} catch {
				return null;
			}
		}
		/** GET /api/activity-feed — recent activity entries (cursor pagination). */
		async function fetchActivityFeed(base, opts = {}, signal) {
			const params = new URLSearchParams();
			if (opts.limit !== void 0) params.set("limit", String(Math.max(1, Math.min(100, opts.limit))));
			if (opts.before !== void 0 && opts.before !== "") params.set("before", opts.before);
			const qs = params.toString();
			const data = await requestJson(base, `/api/activity-feed${qs !== "" ? `?${qs}` : ""}`, {
				timeoutMs: 1e4,
				signal
			});
			const row = typeof data === "object" && data !== null ? data : {};
			return {
				items: asItems(data),
				liveSummary: str(row.live_summary),
				headline: str(row.headline),
				hasMore: row.has_more === true,
				nextCursor: str(row.next_cursor)
			};
		}
		/** Generate one stable idempotency key for a UI action (uuid v4). */
		function stableId() {
			const bytes = new Uint8Array(16);
			crypto.getRandomValues(bytes);
			bytes[6] = bytes[6] & 15 | 64;
			bytes[8] = bytes[8] & 63 | 128;
			const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		/** Probe submitted LLM/embedding/proxy settings without saving config.toml. */
		async function probeConfigService(base, kind, config, instanceId = "", signal) {
			const data = await requestJson(base, "/api/config/probe-service", {
				method: "POST",
				timeoutMs: 6e4,
				signal,
				body: {
					kind,
					instance_id: instanceId,
					config
				}
			});
			const row = typeof data === "object" && data !== null ? data : {};
			return {
				ok: row.ok === true,
				provider: str(row.provider),
				model: str(row.model),
				message: str(row.message),
				error: str(row.error),
				latencyMs: num(row.latency_ms)
			};
		}
		/** List models for one submitted instance without saving config.toml. */
		async function discoverConfigModels(base, instanceId, config, signal) {
			const data = await requestJson(base, "/api/config/discover-models", {
				method: "POST",
				timeoutMs: 6e4,
				signal,
				body: {
					instance_id: instanceId,
					config
				}
			});
			const row = typeof data === "object" && data !== null ? data : {};
			const models = Array.isArray(row.models) ? row.models.map((item) => String(item)) : [];
			const reasoningEfforts = Array.isArray(row.reasoning_efforts) ? row.reasoning_efforts.map((item) => String(item)) : [];
			return {
				ok: row.ok === true,
				models,
				reasoningEfforts,
				error: str(row.error)
			};
		}
		/** Read the LAN password-gate status. */
		async function fetchAuthStatus(base, signal) {
			const data = await requestJson(base, "/api/auth/status", {
				timeoutMs: 1e4,
				signal
			});
			return { enabled: (typeof data === "object" && data !== null ? data : {}).enabled === true };
		}
		/** Enable/disable the LAN password gate (local-only admin surface). */
		async function setLanAuth(base, enabled, password, signal) {
			const data = await requestJson(base, "/api/auth/admin", {
				method: "POST",
				timeoutMs: 15e3,
				signal,
				headers: { "X-OBC-Auth": "1" },
				body: enabled ? {
					enabled: true,
					password
				} : { enabled: false }
			});
			return (typeof data === "object" && data !== null ? data : {}).ok === true;
		}
		/** Read boot-autostart state. */
		async function fetchAutostartStatus(base, signal) {
			const data = await requestJson(base, "/api/autostart-status", {
				timeoutMs: 1e4,
				signal
			});
			return { enabled: (typeof data === "object" && data !== null ? data : {}).enabled === true };
		}
		/** Apply boot-autostart on/off. */
		async function applyAutostart(base, enabled, signal) {
			const data = await requestJson(base, "/api/autostart/apply", {
				method: "POST",
				timeoutMs: 15e3,
				signal,
				headers: { "X-OBC-Auth": "1" },
				body: { enabled: Boolean(enabled) }
			});
			const row = typeof data === "object" && data !== null ? data : {};
			return row.ok === true || row.enabled === enabled;
		}
		/** Read init status. */
		async function fetchInitStatus(base, signal) {
			const data = await requestJson(base, "/api/init-status", {
				timeoutMs: 45e3,
				signal
			});
			const row = typeof data === "object" && data !== null ? data : {};
			return {
				initialized: row.initialized === true,
				running: row.running === true
			};
		}
		/** Restart initialization (rebuild profile + discovery pool). */
		async function startInit(base, payload, signal) {
			await requestJson(base, "/api/init", {
				method: "POST",
				timeoutMs: 6e4,
				signal,
				body: payload
			});
		}
		/** Read backend update status. */
		async function fetchUpdateStatus(base, signal) {
			const asDict = (value) => typeof value === "object" && value !== null ? value : {};
			const root = asDict(await requestJson(base, "/api/update-status", {
				timeoutMs: 1e4,
				signal
			}));
			const row = Object.keys(asDict(root.backend)).length > 0 ? asDict(root.backend) : root;
			return {
				current_version: str(row.current_version),
				latest_version: str(row.latest_version),
				latest_tag: str(row.latest_tag),
				state: str(row.state),
				reason: str(row.reason),
				last_check_at: str(row.last_check_at),
				error: str(row.last_error),
				install_mode: str(row.install_mode)
			};
		}
		/** Trigger an immediate backend update check. */
		async function checkBackendUpdate(base, signal) {
			return requestJson(base, "/api/update/check", {
				method: "POST",
				timeoutMs: 6e4,
				signal,
				body: { include_backend: true }
			});
		}
		/** Start applying a backend update (backend restarts afterwards). */
		async function applyBackendUpdate(base, tag, signal) {
			return requestJson(base, "/api/update/apply", {
				method: "POST",
				timeoutMs: 6e4,
				signal,
				body: {
					target: "backend",
					tag
				}
			});
		}
		//#endregion
		//#region lib/types/client/brandIcon.js
		/**
		* The OpenBiliClaw brand mark — the extension's own icon128.png (pink ring +
		* white paw + sparkles), embedded as a data URI so the panel header shows the
		* same logo the popup shows via ../icons/icon128.png.
		* @module @openbiliclaw/dsh-plugin
		*/
		const BRAND_ICON = "data:image/png;base64,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";
		//#endregion
		//#region lib/types/client/live.js
		/**
		* Runtime-stream WebSocket client: real-time push events (delight candidates,
		* interest/avoidance probes and their outcomes) with automatic reconnect and
		* a small dedupe window so a reconnect burst does not double-fire.
		* @module @openbiliclaw/dsh-plugin
		*/
		const RECONNECT_BASE_MS = 2e3;
		const RECONNECT_MAX_MS = 3e4;
		const DEDUPE_MS = 500;
		/**
		* Live client: subscribes to `/api/runtime-stream`, reconnects with
		* exponential backoff, and forwards typed events to subscribers.
		*/
		var LiveClient = class {
			#base;
			#socket = null;
			#closed = false;
			#timer = null;
			#listeners = /* @__PURE__ */ new Set();
			#lastSeen = /* @__PURE__ */ new Map();
			#onStatus = null;
			#reconnectDelay = RECONNECT_BASE_MS;
			constructor(base) {
				this.#base = base;
			}
			/** Subscribe to stream events; returns the unsubscriber. */
			onEvent(listener) {
				this.#listeners.add(listener);
				return () => {
					this.#listeners.delete(listener);
				};
			}
			/** Observe connection state changes. */
			onStatusChange(listener) {
				this.#onStatus = listener;
				return () => {
					if (this.#onStatus === listener) this.#onStatus = null;
				};
			}
			/** Connect (idempotent; reconnects if a socket already died). */
			connect() {
				if (this.#closed || this.#socket !== null) return;
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
				const wsUrl = this.#base.replace(/^http/, "ws") + "/api/runtime-stream";
				let socket;
				try {
					socket = new WebSocket(wsUrl);
				} catch {
					this.#scheduleReconnect();
					return;
				}
				this.#socket = socket;
				const openedAt = Date.now();
				socket.onopen = () => {
					if (Date.now() - openedAt >= 8e3) this.#reconnectDelay = RECONNECT_BASE_MS;
					this.#onStatus?.(true);
				};
				socket.onmessage = (msg) => {
					this.#handleMessage(msg.data);
				};
				socket.onclose = () => {
					if (this.#socket === socket) this.#socket = null;
					this.#onStatus?.(false);
					this.#scheduleReconnect();
				};
				socket.onerror = () => {};
			}
			#scheduleReconnect() {
				if (this.#closed || this.#timer !== null) return;
				const delay = this.#reconnectDelay;
				this.#reconnectDelay = Math.min(RECONNECT_MAX_MS, this.#reconnectDelay * 2);
				this.#timer = window.setTimeout(() => {
					this.#timer = null;
					if (!this.#closed) this.#open();
				}, delay);
			}
			#handleMessage(raw) {
				let data;
				try {
					data = JSON.parse(raw);
				} catch {
					return;
				}
				if (typeof data !== "object" || data === null) return;
				const inner = data.data;
				if (typeof inner !== "object" || inner === null) return;
				const payload = inner;
				const type = typeof payload.type === "string" ? payload.type : "";
				if (type === "" || type === "connected") return;
				const now = Date.now();
				const last = this.#lastSeen.get(type + (typeof payload.bvid === "string" ? payload.bvid : payload.domain ?? ""));
				if (last !== void 0 && now - last < DEDUPE_MS) return;
				this.#lastSeen.set(type + (typeof payload.bvid === "string" ? payload.bvid : payload.domain ?? ""), now);
				const event = {
					type,
					payload
				};
				for (const listener of [...this.#listeners]) try {
					listener(event);
				} catch {}
			}
		};
		//#endregion
		//#region lib/types/client/icons.js
		/** 推荐 sparkle icon — the popup tab bar's 4-point star (single path). */
		function SparkleIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" })
			});
		}
		/** 内容库 folder icon. */
		function LibraryIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("path", { d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" }), (0, react_jsx_runtime.jsx)("path", { d: "M8 10h8M8 14h6" })]
			});
		}
		/** 画像 user icon. */
		function ProfileIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "8",
					r: "4"
				}), (0, react_jsx_runtime.jsx)("path", { d: "M4 21a8 8 0 0 1 16 0" })]
			});
		}
		/** 对话 chat icon. */
		function ChatIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" })
			});
		}
		/** 消息 icon — the popup's message-bubble (not a bell). */
		function MessageIcon({ size = 20 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
			});
		}
		/** 设置 gear icon. */
		function GearIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "3"
				}), (0, react_jsx_runtime.jsx)("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })]
			});
		}
		/** 收起 (close panel) chevron icon. */
		function CollapseIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "m9 6 6 6-6 6" })
			});
		}
		/** 关闭 close icon. */
		function CloseIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18M6 6l12 12" })
			});
		}
		/** 搜索 icon (probe card type). */
		function SearchIcon({ size = 12 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: "11",
					cy: "11",
					r: "8"
				}), (0, react_jsx_runtime.jsx)("path", { d: "m21 21-4.3-4.3" })]
			});
		}
		/** 稍后再看 clock icon. */
		function ClockIcon({ size = 12 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "9"
				}), (0, react_jsx_runtime.jsx)("path", { d: "M12 7.5V12l3.2 1.9" })]
			});
		}
		/** 收藏 star icon. */
		function StarIcon({ size = 12 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M12 3.6l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 17.1l-5.31 2.8 1.01-5.9L3.41 9.83l5.93-.86z" })
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/white/workspace/OpenBiliClaw/dsh-plugin/src/client/panel.module.css.mjs
		const css = "._2AgH6G_panel{--obc-bg:#fffafc;--obc-sky:#f2f8ff;--obc-surface:#ffffffd6;--obc-surface-strong:#fffffff7;--obc-surface-soft:#ffffffb8;--obc-line:#d9e3f2f2;--obc-line-strong:#f7adca80;--obc-text:#20304a;--obc-text-secondary:#60708c;--obc-text-muted:#8290a8;--obc-brand:#fb7299;--obc-brand-strong:#f65788;--obc-brand-soft:#fb72991f;--obc-sky-blue:#5aa9ff;--obc-sky-soft:#5aa9ff24;--obc-success:#30b980;--obc-danger:#ef7a86;--obc-shadow-lg:0 20px 40px #384c701f;--obc-shadow-sm:0 10px 22px #495d8214;min-width:0;height:100%;color:var(--obc-text);background:radial-gradient(circle at 15% 8%, #fb729929, transparent 30%), radial-gradient(circle at 88% 12%, #5aa9ff2e, transparent 26%), linear-gradient(180deg, var(--obc-bg) 0%, var(--obc-sky) 100%);background-attachment:fixed;flex-direction:column;font-family:Avenir Next,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif;display:flex;position:relative;overflow:hidden}._2AgH6G_panel button,._2AgH6G_panel input,._2AgH6G_panel textarea{font-family:inherit}._2AgH6G_header{flex:none;align-items:center;gap:6px;padding:14px 14px 10px;display:flex}._2AgH6G_brand{flex:1;align-items:center;gap:9px;min-width:0;display:flex}._2AgH6G_brandMark{object-fit:cover;background:linear-gradient(135deg, var(--obc-brand), #ff8cb0);border-radius:10px;flex:none;width:30px;height:30px;display:block;box-shadow:0 8px 16px #fb729940}._2AgH6G_brandCopy{flex-direction:column;min-width:0;display:flex}._2AgH6G_brandTitle{color:var(--obc-text);letter-spacing:-.02em;white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:800;overflow:hidden}._2AgH6G_status{align-items:center;gap:4px;display:flex}._2AgH6G_statusDot{background:var(--obc-danger);border-radius:50%;width:6px;height:6px}._2AgH6G_statusDot[data-online=true]{background:var(--obc-success)}._2AgH6G_statusText{color:var(--obc-text-muted);font-size:10px}._2AgH6G_iconButton{width:30px;height:30px;color:var(--obc-text-secondary);cursor:pointer;background:#ffffffc2;border:1px solid #e6edf8eb;border-radius:10px;flex:none;justify-content:center;align-items:center;transition:background .15s,transform .15s;display:flex;position:relative}._2AgH6G_iconButton:hover{background:var(--obc-brand-soft);color:var(--obc-brand-strong);transform:translateY(-1px)}._2AgH6G_bellBadge{background:var(--obc-brand);color:#fff;min-width:16px;height:16px;box-shadow:0 0 0 2px var(--obc-bg);border-radius:8px;justify-content:center;align-items:center;padding:0 4px;font-size:9px;font-weight:700;display:flex;position:absolute;top:-5px;right:-5px}._2AgH6G_settings{border-bottom:1px solid var(--obc-line);flex-direction:column;gap:6px;padding:0 14px 10px;display:flex}._2AgH6G_settingsRow{align-items:center;gap:6px;display:flex}._2AgH6G_settingsInput{min-width:0;color:var(--obc-text);background:#ffffffd9;border:1px solid #e6edf8eb;border-radius:8px;flex:1;padding:6px 9px;font-size:11px}._2AgH6G_hint{color:var(--obc-text-muted);font-size:10.5px;line-height:1.5}._2AgH6G_tabBar{flex:none;gap:6px;padding:0 14px 12px;display:flex}._2AgH6G_tab{min-width:0;min-height:48px;color:var(--obc-text-secondary);cursor:pointer;background:0 0;border:0;border-radius:16px;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:3px;padding:7px 4px;font-size:10px;font-weight:700;line-height:1.3;transition:background .18s,color .18s,box-shadow .18s,transform .18s;display:flex}._2AgH6G_tab:hover{color:var(--obc-text);background:#ffffff85}._2AgH6G_tab[data-active=true]{color:var(--obc-brand-strong);background:linear-gradient(#fffffffa,#fff0f6fa);transform:translateY(-1px);box-shadow:0 10px 18px #fb729924}._2AgH6G_badge{background:var(--obc-brand);color:#fff;text-align:center;vertical-align:1px;border-radius:8px;min-width:15px;height:15px;margin-left:3px;padding:0 4px;font-size:9px;font-weight:700;line-height:15px;display:inline-block}._2AgH6G_body{flex-direction:column;flex:1;gap:12px;min-height:0;padding:2px 14px 20px;display:flex;overflow-y:auto}._2AgH6G_body>*{flex-shrink:0}._2AgH6G_empty{color:var(--obc-text-muted);text-align:center;padding:26px 10px;font-size:12px;line-height:1.7}._2AgH6G_error{color:var(--obc-danger);white-space:pre-wrap;background:#ef7a861a;border:1px solid #ef7a8640;border-radius:10px;padding:8px 10px;font-size:11.5px;line-height:1.5}._2AgH6G_toolbar{flex:none;align-items:center;gap:6px;display:flex}._2AgH6G_spacer{flex:1}._2AgH6G_sectionTitle{color:var(--obc-text);margin:4px 0 2px;font-size:12px;font-weight:800}._2AgH6G_recHeader{box-shadow:var(--obc-shadow-sm);background:linear-gradient(#ffffffe6,#fafbffe6);border:1px solid #e6edf8eb;border-radius:18px;align-items:flex-start;gap:8px;padding:14px;display:flex}._2AgH6G_recHeaderCopy{flex:1;min-width:0}._2AgH6G_recKicker{letter-spacing:.08em;text-transform:uppercase;color:var(--obc-brand);font-size:9px;font-weight:700}._2AgH6G_recHeaderTitle{color:var(--obc-text);letter-spacing:-.02em;margin-top:2px;font-size:16px;font-weight:800;line-height:1.35}._2AgH6G_poolChips{flex-direction:column;gap:4px;margin-top:8px;display:flex}._2AgH6G_poolChip{color:var(--obc-text-secondary);background:#f0f6ffe6;border-radius:6px;justify-content:space-between;gap:8px;padding:3px 7px;font-size:10px;line-height:1.5;display:flex}._2AgH6G_poolChipLabel{color:var(--obc-text-muted);flex:none;font-weight:600}._2AgH6G_poolChipValue{text-align:right;word-break:break-word}._2AgH6G_delightCard{background:linear-gradient(#fffcfefa,#fcf8fffa);border:1px solid #fb729947;border-radius:18px;flex-direction:column;gap:6px;padding:12px;display:flex;box-shadow:inset 0 1px #ffffffd1,0 4px 14px #fb72991a}._2AgH6G_delightKickerLine{align-items:center;gap:6px;display:flex}._2AgH6G_delightKicker{color:var(--obc-brand-strong);font-size:12px;font-weight:800}._2AgH6G_delightCounter{color:var(--obc-text-muted);margin-left:auto;font-size:10px}._2AgH6G_delightTitle{color:var(--obc-text);letter-spacing:-.01em;-webkit-line-clamp:2;word-break:break-word;-webkit-box-orient:vertical;font-size:14px;font-weight:800;line-height:1.4;display:-webkit-box;overflow:hidden}._2AgH6G_card{box-shadow:var(--obc-shadow-sm);background:linear-gradient(#ffffffeb,#fafbffeb);border:1px solid #e6edf8eb;border-radius:16px;align-items:flex-start;gap:10px;padding:10px;transition:border-color .18s,box-shadow .18s;display:flex}._2AgH6G_card:hover{border-color:var(--obc-line-strong);box-shadow:0 14px 26px #fb72991a}._2AgH6G_thumb{object-fit:cover;background:linear-gradient(145deg,#fb72991f,#5aa9ff1a);border-radius:10px;flex:none;width:84px;height:58px;display:block}._2AgH6G_thumbFallback{width:84px;height:58px;color:var(--obc-text-secondary);background:linear-gradient(145deg,#fb72991f,#5aa9ff1a);border-radius:10px;flex:none;justify-content:center;align-items:center;font-size:16px;font-weight:700;display:flex}._2AgH6G_coverWrap{flex:none;position:relative}._2AgH6G_coverCorner{color:#fff;background:#20304a9e;border-radius:4px;padding:0 4px;font-size:8px;font-weight:700;line-height:13px;position:absolute;top:4px;left:4px}._2AgH6G_cardBody{flex-direction:column;flex:1;align-self:center;gap:3px;min-width:0;display:flex}._2AgH6G_cardTitle{min-height:36px;color:var(--obc-text);letter-spacing:-.01em;-webkit-line-clamp:2;word-break:break-word;-webkit-box-orient:vertical;font-size:13px;font-weight:800;line-height:1.4;display:-webkit-box;overflow:hidden}._2AgH6G_cardMeta{color:var(--obc-text-muted);flex-wrap:wrap;align-items:center;gap:6px;font-size:10px;display:flex}._2AgH6G_platformTag{color:var(--obc-text-secondary);background:#f0f6ffe6;border-radius:4px;padding:0 5px;font-size:9px;font-weight:600;line-height:15px}._2AgH6G_badgeRow{flex-wrap:wrap;align-items:center;gap:5px;display:flex}._2AgH6G_stateBadge{color:var(--obc-text-muted);background:#f0f6ffe6;border-radius:5px;padding:0 5px;font-size:9px;line-height:15px}._2AgH6G_topicBadge{background:var(--obc-brand-soft);color:var(--obc-brand-strong);border-radius:5px;padding:0 5px;font-size:9px;font-weight:700;line-height:15px}._2AgH6G_contextBadge{color:var(--obc-text-secondary);background:#f0f6ffe6;border-radius:4px;padding:0 5px;font-size:9px;font-weight:600;line-height:15px}._2AgH6G_contextBadge[data-kind=restored]{color:var(--obc-success);background:#30b9801f}._2AgH6G_contextBadge[data-kind=removed]{color:var(--obc-danger);background:#ef7a861f}._2AgH6G_stats{color:var(--obc-text-muted);flex-wrap:wrap;gap:8px;font-size:10px;display:flex}._2AgH6G_expression{color:var(--obc-text-secondary);-webkit-line-clamp:3;-webkit-box-orient:vertical;font-size:11.5px;line-height:1.6;display:-webkit-box;overflow:hidden}._2AgH6G_feedbackStatus{color:var(--obc-text-muted);min-height:13px;font-size:10.5px;line-height:1.4}._2AgH6G_cardActions{flex-wrap:wrap;gap:6px;margin-top:3px;display:flex}._2AgH6G_actionButton{cursor:pointer;min-height:26px;color:var(--obc-text-secondary);background:#f0f6ffe6;border:0;border-radius:11px;padding:4px 10px;font-size:11px;font-weight:600;line-height:1.2;transition:background .18s,color .18s,box-shadow .18s,transform .18s}._2AgH6G_actionButton:hover:not(:disabled){color:var(--obc-text);transform:translateY(-1px)}._2AgH6G_actionButton:disabled{cursor:not-allowed;opacity:.6;transform:none}._2AgH6G_actionButton[data-primary=true]{background:linear-gradient(135deg, var(--obc-brand), #ff8cb0);color:#fff;font-weight:800;box-shadow:0 8px 14px #fb729938}._2AgH6G_actionButton[data-primary=true]:hover:not(:disabled){background:linear-gradient(135deg, var(--obc-brand-strong), #ff7ca7);color:#fff}._2AgH6G_actionButton[data-danger=true]:hover:not(:disabled){color:var(--obc-danger);background:#ef7a861f}._2AgH6G_commentRow{align-items:center;gap:6px;display:flex}._2AgH6G_commentInput{min-width:0;color:var(--obc-text);background:#ffffffd9;border:1px solid #e6edf8eb;border-radius:8px;flex:1;padding:4px 8px;font-size:11px}._2AgH6G_commentInput:focus{border-color:var(--obc-sky-blue);outline:none}._2AgH6G_loadMore{color:var(--obc-text-secondary);cursor:pointer;background:0 0;border:1px dashed #d9e3f2f2;border-radius:10px;padding:7px;font-size:11.5px}._2AgH6G_loadMore:hover:not(:disabled){color:var(--obc-text);border-color:var(--obc-sky-blue)}._2AgH6G_loadMore:disabled{opacity:.5}._2AgH6G_loadingRow{color:var(--obc-text-muted);justify-content:center;align-items:center;gap:8px;padding:10px 0 4px;font-size:11px;font-weight:700;display:flex}._2AgH6G_spinner{border:2px solid #fb729938;border-top-color:var(--obc-brand);border-radius:999px;width:14px;height:14px;animation:.8s linear infinite _2AgH6G_obcSpin}@keyframes _2AgH6G_obcSpin{to{transform:rotate(360deg)}}._2AgH6G_activityFooter{border-top:1px solid var(--obc-line);padding-top:8px}._2AgH6G_activityRow{color:var(--obc-text-secondary);gap:8px;padding:4px 0;font-size:11px;line-height:1.5;display:flex}._2AgH6G_activityTime{color:var(--obc-text-muted);flex:none;padding-top:1px;font-size:10px}._2AgH6G_subTabs{border:1px solid var(--obc-line);background:#ffffffa8;border-radius:12px;flex:none;gap:4px;padding:4px;display:flex}._2AgH6G_subTab{color:var(--obc-text-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:0;border-radius:9px;flex:1;padding:6px 4px;font-size:10.5px;font-weight:700;line-height:1.4}._2AgH6G_subTab:hover{color:var(--obc-text)}._2AgH6G_subTab[data-active=true]{background:var(--obc-surface-strong);color:var(--obc-brand-strong);box-shadow:var(--obc-shadow-sm)}._2AgH6G_turn{flex-direction:column;gap:3px;display:flex}._2AgH6G_turnUser,._2AgH6G_turnSoul{white-space:pre-wrap;word-break:break-word;border-radius:14px;padding:8px 11px;font-size:12px;line-height:1.6}._2AgH6G_turnUser{background:var(--obc-brand-soft);color:var(--obc-text);align-self:flex-end;max-width:92%}._2AgH6G_turnSoul{border:1px solid var(--obc-line);color:var(--obc-text);background:#ffffffe6;align-self:flex-start;max-width:92%}._2AgH6G_turnStatus{color:var(--obc-text-muted);align-self:flex-end;font-size:10px}._2AgH6G_chatInputRow{border-top:1px solid var(--obc-line);flex:none;gap:6px;padding-top:8px;display:flex}._2AgH6G_chatInput{min-width:0;color:var(--obc-text);resize:none;background:#ffffffe6;border:1px solid #e6edf8eb;border-radius:12px;flex:1;padding:8px 10px;font-size:12px}._2AgH6G_chatInput:focus{border-color:var(--obc-sky-blue);outline:none}._2AgH6G_chatSend{background:linear-gradient(135deg, var(--obc-brand), #ff8cb0);color:#fff;cursor:pointer;border:0;border-radius:12px;padding:0 14px;font-size:12px;font-weight:800;box-shadow:0 8px 14px #fb729938}._2AgH6G_chatSend:hover:not(:disabled){background:linear-gradient(135deg, var(--obc-brand-strong), #ff7ca7)}._2AgH6G_chatSend:disabled{opacity:.6}._2AgH6G_confirmPanel{border:1px solid var(--obc-line);background:#ffffffd9;border-radius:14px;flex:none;overflow:hidden}._2AgH6G_confirmToggle{width:100%;color:var(--obc-text);cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:9px 11px;font-size:12px;font-weight:800;display:flex}._2AgH6G_confirmToggle:hover{background:var(--obc-brand-soft)}._2AgH6G_confirmCount{color:#fff;background:var(--obc-brand);border-radius:8px;margin-left:auto;padding:1px 7px;font-size:10px;font-weight:700}._2AgH6G_confirmItem{border-top:1px solid var(--obc-line);flex-direction:column;gap:4px;padding:10px 11px;display:flex}._2AgH6G_confirmTitle{color:var(--obc-text);font-size:12px;font-weight:800;line-height:1.5}._2AgH6G_cardTurn{border:1px solid var(--obc-line);background:#ffffffe6;border-radius:14px;flex-direction:column;gap:4px;padding:10px 11px;display:flex}._2AgH6G_insightEvidence{color:var(--obc-text-secondary);white-space:pre-wrap;font-size:11px;line-height:1.55}._2AgH6G_insightNote{color:var(--obc-text-muted);font-size:10.5px}._2AgH6G_probeConfidence{color:var(--obc-text-muted);font-size:10px}._2AgH6G_portrait{color:var(--obc-text);border:1px solid var(--obc-line);background:#ffffffd9;border-radius:14px;padding:11px 12px;font-size:12.5px;line-height:1.7}._2AgH6G_chipRow{flex-wrap:wrap;gap:5px;display:flex}._2AgH6G_chip{color:var(--obc-text-secondary);background:#f0f6ffe6;border-radius:11px;padding:2px 8px;font-size:10.5px;font-weight:600;line-height:1.6}._2AgH6G_chip[data-kind=dislike]{color:var(--obc-danger);background:#ef7a861f}._2AgH6G_interestDomain{margin-bottom:6px}._2AgH6G_interestDomainHead{color:var(--obc-text);align-items:center;gap:6px;font-size:12px;font-weight:800;display:flex}._2AgH6G_domainWeight{color:var(--obc-text-muted);font-size:10px;font-weight:600}._2AgH6G_awarenessRow{color:var(--obc-text-secondary);padding:4px 0;font-size:11px;line-height:1.55}._2AgH6G_awarenessDate{color:var(--obc-text-muted);margin-right:6px}._2AgH6G_probe{border:1px solid var(--obc-line);background:#ffffffd9;border-radius:12px;flex-direction:column;gap:4px;padding:10px 11px;display:flex}._2AgH6G_probeDomain{color:var(--obc-text);font-size:12px;font-weight:800}._2AgH6G_probeReason{color:var(--obc-text-secondary);font-size:11.5px;line-height:1.55}._2AgH6G_probeActions{flex-wrap:wrap;gap:6px;margin-top:2px;display:flex}._2AgH6G_drawerOverlay{z-index:10;backdrop-filter:blur(2px);background:#20304a47;flex-direction:column;justify-content:flex-start;display:flex;position:absolute;inset:0}._2AgH6G_drawerPanel{background:radial-gradient(circle at 15% 4%, #fb729924, transparent 30%), var(--obc-bg);border-radius:18px 18px 0 0;flex-direction:column;flex:1;gap:10px;min-height:0;margin-top:8px;padding:14px 14px 24px;display:flex;overflow-y:auto}._2AgH6G_drawerHeader{border-bottom:1px solid var(--obc-line);justify-content:space-between;align-items:center;padding-bottom:10px;display:flex}._2AgH6G_drawerTitle{color:var(--obc-text);align-items:center;gap:6px;font-size:15px;font-weight:800;display:flex}._2AgH6G_messageCard{background:var(--obc-surface-strong);border:1px solid var(--obc-line);border-radius:14px;flex-direction:column;gap:5px;padding:11px 12px;display:flex}._2AgH6G_messageCard[data-tone=interest]{background:linear-gradient(135deg,#fff8e8,#fff0d5);border-color:#dd7f2d47}._2AgH6G_messageCard[data-tone=avoidance]{background:linear-gradient(135deg,#eef7ff,#e1effc);border-color:#3b82f647}._2AgH6G_messageCard[data-tone=challenge]{background:linear-gradient(135deg,#f7f2ff,#ede9fe);border-color:#7c3aed47}._2AgH6G_messageCard[data-tone=delight]{background:linear-gradient(135deg,#fff5f8,#ffe9f0);border-color:#fb729952}._2AgH6G_messageType{color:var(--obc-text-secondary);align-items:center;gap:5px;font-size:10.5px;font-weight:800;display:flex}._2AgH6G_messageCard[data-tone=interest] ._2AgH6G_messageType{color:#c26a1d}._2AgH6G_messageCard[data-tone=avoidance] ._2AgH6G_messageType{color:#2b6cc4}._2AgH6G_messageCard[data-tone=challenge] ._2AgH6G_messageType{color:#7c3aed}._2AgH6G_messageCard[data-tone=delight] ._2AgH6G_messageType{color:var(--obc-brand-strong)}._2AgH6G_messagePrompt{color:var(--obc-text-secondary);font-size:10.5px;line-height:1.5}._2AgH6G_messageTitle{color:var(--obc-text);font-size:13px;font-weight:800;line-height:1.45}._2AgH6G_messageBody{color:#55657f;-webkit-line-clamp:4;-webkit-box-orient:vertical;font-size:11px;line-height:1.55;display:-webkit-box;overflow:hidden}._2AgH6G_messageActions{flex-wrap:wrap;gap:6px;margin-top:2px;display:flex}._2AgH6G_drawerEmpty{color:var(--obc-text-muted);flex-direction:column;align-items:center;gap:8px;padding:34px 20px;display:flex}._2AgH6G_drawerEmptyTitle{font-size:13px;font-weight:700}._2AgH6G_drawerEmptySubtitle{opacity:.75;font-size:11px}._2AgH6G_recCard{background:linear-gradient(#fffffffa,#fafbfffa);border:1px solid #ebf0f8fa;border-radius:18px;flex-direction:column;gap:9px;padding:10px;transition:border-color .18s,box-shadow .18s;display:flex;box-shadow:inset 0 1px #ffffffd1}._2AgH6G_recCard:hover{border-color:var(--obc-line-strong);box-shadow:0 18px 32px #fb729924}._2AgH6G_recCover{aspect-ratio:16/9;cursor:pointer;width:100%;color:var(--obc-text-secondary);text-align:center;background:linear-gradient(145deg,#fb72991f,#5aa9ff1a),#f6f9fff0;border:0;border-radius:13px;justify-content:center;align-items:center;padding:0;font-size:12px;font-weight:700;line-height:1.5;display:flex;position:relative;overflow:hidden}._2AgH6G_recCover img{object-fit:cover;width:100%;height:100%;display:block}._2AgH6G_recCoverText{color:var(--obc-text);-webkit-line-clamp:4;-webkit-box-orient:vertical;padding:12px;font-size:12px;line-height:1.6;display:-webkit-box;overflow:hidden}._2AgH6G_recCover ._2AgH6G_coverCorner{top:8px;left:8px}._2AgH6G_recBody{flex-direction:column;gap:4px;padding:0 2px;display:flex}._2AgH6G_recTitle{color:var(--obc-text);letter-spacing:-.01em;-webkit-line-clamp:2;word-break:break-word;-webkit-box-orient:vertical;font-size:15px;font-weight:800;line-height:1.38;display:-webkit-box;overflow:hidden}._2AgH6G_delightRow{align-items:stretch;gap:10px;display:flex}._2AgH6G_delightThumb{object-fit:cover;border-radius:12px;flex:none;align-self:center;width:96px;height:96px;box-shadow:inset 0 1px #ffffffb8}._2AgH6G_delightThumbFallback{box-sizing:border-box;width:96px;height:96px;color:var(--obc-text-secondary);text-align:center;background:linear-gradient(145deg,#fb729924,#5aa9ff1f);border-radius:12px;flex:none;justify-content:center;align-self:center;align-items:center;padding:8px;font-size:10.5px;font-weight:700;line-height:1.5;display:flex;overflow:hidden}._2AgH6G_delightCard{background:radial-gradient(circle at 100% 0,#fb729924,#0000 38%),linear-gradient(#fffcfefa,#f6fafffa);border:1px solid #fb729947;border-radius:18px;flex-shrink:0;grid-template-columns:minmax(0,1fr) 40px;gap:0;padding:0;transition:border-color .2s,box-shadow .2s;display:grid;overflow:hidden;box-shadow:inset 0 1px #ffffffd1,0 4px 14px #fb72991a}._2AgH6G_delightRow{cursor:pointer;text-align:left;min-width:0;color:inherit;background:0 0;border:0;grid-area:1/1;align-items:center;gap:10px;padding:10px;display:flex}._2AgH6G_delightThumb{aspect-ratio:16/9;object-fit:cover;background:linear-gradient(#fffffffa,#fff8fcf0),linear-gradient(145deg,#fb72992e,#a855f71f);border:1px solid #ffffffeb;border-radius:12px;flex:none;width:104px;height:auto;transition:transform .2s,box-shadow .2s;box-shadow:inset 0 1px #ffffffb8,0 2px 8px #fb72991f}._2AgH6G_delightCard:hover ._2AgH6G_delightThumb{transform:scale(1.02);box-shadow:inset 0 1px #ffffffb8,0 6px 14px #fb729938}._2AgH6G_delightText{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}._2AgH6G_delightKickerLine{flex-wrap:wrap;align-items:center;gap:5px;min-width:0;display:flex}._2AgH6G_delightKicker{color:var(--obc-brand-strong);letter-spacing:.02em;text-overflow:ellipsis;white-space:nowrap;background:#fb72991a;border-radius:999px;max-width:100%;padding:2px 7px;font-size:9.5px;font-weight:700;overflow:hidden}._2AgH6G_delightCounter{color:var(--obc-text-muted);white-space:nowrap;background:#0000000a;border-radius:8px;flex:none;padding:1px 6px;font-size:10px;font-weight:600}._2AgH6G_delightNav:active:not(:disabled){transform:scale(.94)}._2AgH6G_delightDismiss{color:var(--obc-text-muted);cursor:pointer;background:0 0;border:0;border-left:1px solid #eddbe999;grid-area:1/2;font-size:15px;line-height:1;transition:background .15s,color .15s}._2AgH6G_delightBody{border-top:1px solid #eddbe999;flex-direction:column;grid-area:2/1/auto/-1;gap:8px;padding:4px 12px 12px;display:flex}._2AgH6G_activityFooter{border:1px solid var(--obc-line);backdrop-filter:blur(18px);box-shadow:var(--obc-shadow-sm);background:#ffffffa8;border-radius:14px;flex-direction:column;gap:8px;padding:10px 12px;display:flex}._2AgH6G_activityLine{color:var(--obc-text-secondary);font-size:11.5px;line-height:1.5}._2AgH6G_footerItem{background:#fffc;border:1px solid #dfe7f3f5;border-radius:12px;flex-direction:column;gap:3px;padding:8px 10px;display:flex}._2AgH6G_footerItemMeta{color:var(--obc-text-muted);flex-wrap:wrap;align-items:center;gap:7px;font-size:9.5px;font-weight:700;line-height:1.4;display:flex}._2AgH6G_footerItemKind{min-height:18px;color:var(--obc-text-secondary);background:#fffffff5;border:1px solid #dfe7f3f5;border-radius:999px;align-items:center;padding:2px 7px;display:inline-flex}._2AgH6G_footerItemSummary{color:var(--obc-text-secondary);word-break:break-word;font-size:11px;line-height:1.55}._2AgH6G_pinnedFooter{border-top:1px solid var(--obc-line);backdrop-filter:blur(18px);background:#ffffff80;flex:none;padding:9px 14px 12px}._2AgH6G_pinnedFooter ._2AgH6G_activityFooter{box-shadow:none;backdrop-filter:none;background:0 0;border:0;border-radius:0;gap:5px;margin:0;padding:6px 2px 2px}._2AgH6G_expression{-webkit-line-clamp:unset;display:block;overflow:visible}._2AgH6G_savedToggle{min-width:38px;min-height:26px;color:var(--obc-text-secondary);cursor:pointer;background:#f0f6ffe6;border:0;border-radius:11px;justify-content:center;align-items:center;transition:background .15s,color .15s,transform .15s;display:inline-flex}._2AgH6G_savedToggle:hover:not(:disabled){color:var(--obc-text);transform:translateY(-1px)}._2AgH6G_savedToggle:disabled{opacity:.6;cursor:wait}._2AgH6G_savedToggle[data-pressed=true]._2AgH6G_watchToggle{color:var(--obc-brand-strong);background:var(--obc-brand-soft)}._2AgH6G_savedToggle[data-pressed=true]._2AgH6G_starToggle{color:#e8a33d;background:#e8a33d1f}._2AgH6G_savedToggle[data-pressed=true]._2AgH6G_starToggle svg{fill:currentColor}._2AgH6G_feedbackStatus{color:var(--obc-brand-strong);min-height:15px;margin-top:2px;font-size:11px;line-height:1.5}._2AgH6G_feedbackStatus[data-tone=success]{color:var(--obc-success)}._2AgH6G_feedbackStatus[data-tone=error]{color:var(--obc-danger)}._2AgH6G_commentComposer{flex-direction:column;gap:6px;margin-top:2px;display:flex}._2AgH6G_commentComposer textarea{box-sizing:border-box;width:100%;color:var(--obc-text);resize:vertical;background:#ffffffe6;border:1px solid #e6edf8eb;border-radius:10px;padding:8px 9px;font-family:inherit;font-size:11.5px}._2AgH6G_commentComposer textarea:focus{border-color:var(--obc-sky-blue);outline:none}._2AgH6G_commentComposer ._2AgH6G_actionButton{align-self:flex-end}._2AgH6G_activityFooter{background:linear-gradient(#fffffffa,#f2f6fdf5);border:1px solid #dfe7f3fa;border-radius:18px;flex-direction:column;gap:10px;margin:0;padding:12px 14px;display:flex;box-shadow:0 12px 24px #495d8214}._2AgH6G_footerHead{justify-content:space-between;align-items:flex-start;gap:10px;display:flex}._2AgH6G_footerCopy{flex-direction:column;flex:auto;gap:6px;min-width:0;display:flex}._2AgH6G_footerHint{color:#41506b;min-height:18px;margin:0;padding-left:20px;font-size:12px;font-weight:700;line-height:1.6;position:relative}._2AgH6G_footerHint:before{content:\"\";background:var(--obc-sky-blue);border-radius:999px;width:9px;height:9px;position:absolute;top:50%;left:0;transform:translateY(-50%);box-shadow:0 0 0 4px #5aa9ff1f}._2AgH6G_footerHeadline{min-height:16px;color:var(--obc-text-muted);-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0;padding-left:20px;font-size:10.5px;font-weight:700;line-height:1.55;display:-webkit-box;position:relative;overflow:hidden}._2AgH6G_footerHeadline:before{content:\"\";background:#fb72994d;border-radius:999px;width:9px;height:9px;position:absolute;top:50%;left:0;transform:translateY(-50%);box-shadow:0 0 0 4px #fb729914}._2AgH6G_footerToggle{min-height:32px;color:var(--obc-text-secondary);cursor:pointer;background:#ffffffdb;border:0;border-radius:999px;flex-shrink:0;padding:7px 12px;font-size:11px;font-weight:800;line-height:1;box-shadow:0 8px 18px #495d8214}._2AgH6G_footerToggle:hover{color:var(--obc-text)}._2AgH6G_footerHistory{flex-direction:column;gap:8px;max-height:190px;display:flex;overflow-y:auto}._2AgH6G_pendingItem{border-top:1px solid var(--obc-line);grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;display:grid}._2AgH6G_pendingCopy{gap:2px;min-width:0;display:grid}._2AgH6G_pendingCopy strong{overflow-wrap:anywhere;color:var(--obc-text);font-size:12px;font-weight:800;line-height:1.45}._2AgH6G_pendingKind,._2AgH6G_pendingConfidence{color:var(--obc-text-secondary);font-size:10.5px;font-weight:700}._2AgH6G_pendingOpen{cursor:pointer;border:1px solid var(--obc-line-strong);background:var(--obc-brand-soft);min-width:52px;min-height:34px;color:var(--obc-brand-strong);border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800}._2AgH6G_pendingOpen:hover:not(:disabled){background:#fb729933}._2AgH6G_pendingOpen:disabled{opacity:.6;cursor:wait}._2AgH6G_dialogueCard{box-sizing:border-box;overflow-wrap:anywhere;border:1px solid var(--obc-line-strong);background:var(--obc-surface-strong);width:100%;box-shadow:var(--obc-shadow-sm);border-radius:14px;flex-direction:column;gap:5px;padding:12px;display:flex}._2AgH6G_dialogueCard[data-card-state=confirmed]{border-color:#30b9808c}._2AgH6G_dialogueCard[data-card-state=rejected]{border-color:#ef7a8694}._2AgH6G_dialogueCard[data-card-state=deferred]{border-color:#8f9bb09e}._2AgH6G_dialogueKicker{color:var(--obc-brand-strong);letter-spacing:.06em;font-size:10.5px;font-weight:800}._2AgH6G_dialogueTitle{color:var(--obc-text);font-size:13.5px;font-weight:700;line-height:1.55}._2AgH6G_dialogueState{color:var(--obc-text-secondary);font-size:11.5px;font-weight:700}._2AgH6G_dialogueEvidence{color:var(--obc-text-secondary);font-size:11.5px}._2AgH6G_dialogueEvidence summary{cursor:pointer;width:fit-content;color:var(--obc-text-secondary);align-items:center;font-weight:700;display:flex}._2AgH6G_dialogueEvidence ul{gap:5px;margin:3px 0 0 16px;line-height:1.55;display:grid}._2AgH6G_dialogueActions{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:6px;display:grid}._2AgH6G_dialogueAction{cursor:pointer;border:1px solid var(--obc-line);background:var(--obc-surface);min-width:0;min-height:34px;color:var(--obc-text);border-radius:999px;padding:7px;font-size:12px;font-weight:800;transition:background .15s,transform .15s}._2AgH6G_dialogueAction:hover:not(:disabled){transform:translateY(-1px)}._2AgH6G_dialogueAction:disabled{cursor:default;opacity:.5}._2AgH6G_dialogueAction._2AgH6G_action_confirm{color:var(--obc-success)}._2AgH6G_dialogueAction._2AgH6G_action_reject{color:var(--obc-danger)}._2AgH6G_dialogueAction._2AgH6G_action_discuss{color:var(--obc-brand-strong)}._2AgH6G_contextBar{border:1px solid var(--obc-line-strong);background:var(--obc-surface-soft);border-radius:12px;flex-direction:column;flex:none;gap:4px;min-width:0;padding:9px 11px;display:flex}._2AgH6G_contextBarHead{justify-content:space-between;align-items:center;gap:8px;display:flex}._2AgH6G_contextLabel{letter-spacing:.04em;color:var(--obc-brand-strong);font-size:10px;font-weight:800}._2AgH6G_contextTitle{color:var(--obc-text);overflow-wrap:anywhere;font-size:12.5px;font-weight:800;line-height:1.45}._2AgH6G_contextObservation{color:var(--obc-text-secondary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:11px;line-height:1.55;display:-webkit-box;overflow:hidden}._2AgH6G_contextInterpretation{color:#2b6cc4;font-size:10.5px;font-weight:600;line-height:1.5}._2AgH6G_contextClear{color:var(--obc-text-secondary);cursor:pointer;background:#fffc;border:0;border-radius:999px;flex:none;padding:4px 10px;font-size:10.5px;font-weight:700}._2AgH6G_contextClear:hover{color:var(--obc-text)}._2AgH6G_replyQuote{border-left:3px solid var(--obc-brand);background:var(--obc-brand-soft);border-radius:8px;flex-direction:column;gap:1px;min-width:0;padding:6px 9px;display:flex}._2AgH6G_replyQuote span{color:var(--obc-brand-strong);letter-spacing:.04em;font-size:9.5px;font-weight:800}._2AgH6G_replyQuote strong{color:var(--obc-text-secondary);text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:1.4;overflow:hidden}._2AgH6G_viewIntro{padding:2px 4px 0}._2AgH6G_viewKicker{letter-spacing:.08em;text-transform:uppercase;color:var(--obc-brand);font-size:9px;font-weight:700}._2AgH6G_viewIntro h2{color:var(--obc-text);letter-spacing:-.02em;margin:2px 0 0;font-size:15px;font-weight:800;line-height:1.35}._2AgH6G_viewIntro p{color:var(--obc-text-secondary);margin:3px 0 0;font-size:11px;line-height:1.6}._2AgH6G_profileCard{flex-direction:column;gap:10px;display:flex}._2AgH6G_profileSummary{background:#fcfafbf5;border:1px solid #e4dce8b3;border-radius:16px;padding:14px 16px}._2AgH6G_profilePortraitP{color:var(--obc-text);text-indent:1.6em;margin:0;font-size:12.5px;line-height:1.85}._2AgH6G_profilePortraitP:first-child{text-indent:0}._2AgH6G_profileLayer{text-transform:uppercase;letter-spacing:.05em;color:var(--obc-text-muted);border-bottom:1px solid #e7eef899;margin-top:10px;margin-bottom:2px;padding:5px 0;font-size:9.5px;font-weight:700}._2AgH6G_profileGroup{background:#fffffff0;border:1px solid #e7eef8f5;border-radius:16px;flex-direction:column;gap:8px;padding:12px 14px;display:flex}._2AgH6G_profileGroup h3{color:var(--obc-text);margin:0;font-size:12px;font-weight:800;line-height:1.4}._2AgH6G_profilePhaseCopy{color:var(--obc-text-secondary);margin:0;font-size:12px;line-height:1.7}._2AgH6G_chip[data-tone=brand]{background:var(--obc-brand-soft);color:var(--obc-brand-strong)}._2AgH6G_chip[data-tone=success]{color:var(--obc-success);background:#30b9801f}._2AgH6G_chip[data-tone=danger]{color:var(--obc-danger);background:#ef7a861f}._2AgH6G_chipWeight{opacity:.75;margin-left:3px;font-size:9px}._2AgH6G_mbtiContainer{flex-direction:column;gap:8px;display:flex}._2AgH6G_mbtiTypeRow{align-items:baseline;gap:8px;display:flex}._2AgH6G_mbtiTypeLabel{color:var(--obc-brand-strong);letter-spacing:.02em;font-size:18px;font-weight:800}._2AgH6G_mbtiConfidence{color:var(--obc-text-muted);background:#e7eef8f5;border-radius:999px;padding:2px 8px;font-size:9.5px;font-weight:600}._2AgH6G_mbtiDimensions{flex-direction:column;gap:6px;display:flex}._2AgH6G_mbtiDimRow{align-items:center;gap:8px;font-size:10.5px;display:flex}._2AgH6G_mbtiDimPole{text-align:center;width:20px;color:var(--obc-brand-strong);font-weight:700}._2AgH6G_mbtiDimBar{background:#e7eef8f5;border-radius:3px;flex:1;height:6px;overflow:hidden}._2AgH6G_mbtiDimBarFill{background:linear-gradient(90deg,#f7828e,#c7698f);border-radius:3px;height:100%}._2AgH6G_mbtiDimPct{text-align:right;width:32px;color:var(--obc-text-muted);font-size:9.5px}._2AgH6G_interestTree{flex-direction:column;gap:8px;display:flex}._2AgH6G_interestTreeLabel{font-size:11.5px;font-weight:700}._2AgH6G_interestTreeLabel[data-tone=sky]{color:var(--obc-sky-blue)}._2AgH6G_interestTreeLabel[data-tone=danger]{color:var(--obc-danger)}._2AgH6G_interestDomain{flex-direction:column;gap:5px;display:flex}._2AgH6G_interestDomainHeader{align-items:center;gap:6px;display:flex}._2AgH6G_interestDomainName{color:var(--obc-text);font-size:12px;font-weight:800}._2AgH6G_interestDomainWeight{color:var(--obc-text-muted);background:#e7eef8f5;border-radius:999px;padding:1px 7px;font-size:9.5px;font-weight:600}._2AgH6G_barRow{align-items:center;gap:8px;font-size:11px;display:flex}._2AgH6G_barLabel{min-width:64px;color:var(--obc-text-secondary)}._2AgH6G_barTrack{background:#e7eef8f5;border-radius:3px;flex:1;height:6px;overflow:hidden}._2AgH6G_barFill{background:linear-gradient(90deg,#397fcb,#5e9fd9);border-radius:3px;height:100%}._2AgH6G_barPct{text-align:right;width:34px;color:var(--obc-text-muted);font-size:9.5px}._2AgH6G_contextRow{gap:8px;font-size:11px;display:flex}._2AgH6G_contextLabel{color:var(--obc-text-secondary);flex:none;min-width:44px}._2AgH6G_contextValue{color:var(--obc-text)}._2AgH6G_probe[data-tone=interest]{background:linear-gradient(135deg,#fff8e8,#fff0d5);border-color:#dd7f2d47}._2AgH6G_probe[data-tone=avoidance]{background:linear-gradient(135deg,#eef7ff,#e1effc);border-color:#3b82f647}._2AgH6G_probeHead{justify-content:space-between;align-items:center;gap:8px;display:flex}._2AgH6G_insightCard{border:1px solid var(--obc-line);background:#fffffff0;border-radius:14px;flex-direction:column;gap:7px;padding:12px 14px;display:flex}._2AgH6G_insightCard[data-validated]{border-color:#30b98080}._2AgH6G_insightHead{align-items:flex-start;gap:6px;display:flex}._2AgH6G_insightTitle{color:var(--obc-text);flex:1;font-size:12px;font-weight:800;line-height:1.5}._2AgH6G_insightValidated{color:var(--obc-success);background:#30b9801f;border-radius:999px;flex:none;padding:2px 7px;font-size:9.5px;font-weight:700}._2AgH6G_insightConfidenceRow{align-items:center;gap:8px;display:flex}._2AgH6G_insightConfidenceBar{background:#e7eef8f5;border-radius:3px;flex:1;height:6px;overflow:hidden}._2AgH6G_insightConfidenceFill{background:linear-gradient(90deg,#f7828e,#c7698f);border-radius:3px;height:100%}._2AgH6G_insightConfidenceLabel{color:var(--obc-text-muted);text-align:right;width:32px;font-size:9.5px}._2AgH6G_insightEvidenceList{color:var(--obc-text-secondary);gap:4px;margin:0;padding-left:16px;font-size:11px;line-height:1.55;display:grid}._2AgH6G_awarenessList{flex-direction:column;gap:8px;display:flex}._2AgH6G_awarenessItem{background:#fffcf7f7;border:1px solid #f0e6d7e6;border-radius:14px;flex-direction:column;gap:4px;padding:10px 13px;display:flex}._2AgH6G_awarenessHeader{align-items:center;gap:8px;display:flex}._2AgH6G_awarenessItemDate{color:var(--obc-text-muted);white-space:nowrap;font-size:10px}._2AgH6G_awarenessEmotion{color:var(--obc-brand);font-size:10px;font-weight:600}._2AgH6G_awarenessObservation{color:var(--obc-text);font-size:11.5px;line-height:1.65}._2AgH6G_awarenessTrend{color:var(--obc-text-secondary);border-left:2px solid #fb729940;padding-left:8px;font-size:11px;line-height:1.5}._2AgH6G_questionCard{box-sizing:border-box;width:100%;box-shadow:var(--obc-shadow-sm);background:linear-gradient(135deg,#eef7ff,#e1effc);border:1px solid #3b82f647;border-radius:14px;flex-direction:column;gap:6px;padding:12px;display:flex}._2AgH6G_pendingObservation{color:var(--obc-text-secondary);font-size:11px;line-height:1.55}._2AgH6G_pendingInterpretation{color:var(--obc-sky-blue);font-size:10.5px;font-weight:600;line-height:1.5}._2AgH6G_questionObservation{color:var(--obc-text);background:#ffffffb3;border-radius:8px;padding:6px 9px;font-size:11.5px;line-height:1.6}._2AgH6G_questionInterpretation{color:#2b6cc4;font-size:11px;font-weight:600;line-height:1.55}._2AgH6G_delightCard{background:radial-gradient(circle at 100% 0,#fb729924,#0000 38%),linear-gradient(#fffcfefa,#f6fafffa);border:1px solid #fb729938;border-radius:16px;flex-direction:column;grid-template-columns:none;gap:0;padding:0;transition:border-color .2s,box-shadow .2s;display:flex;overflow:hidden;box-shadow:inset 0 1px #ffffffd1,0 4px 14px #fb72991a}._2AgH6G_delightKicker{color:var(--obc-brand-strong);letter-spacing:.02em;white-space:nowrap;background:#fb72991a;border-radius:999px;padding:2px 7px;font-size:9.5px;font-weight:700}._2AgH6G_delightPlatform{color:var(--obc-text-muted);white-space:nowrap;background:#0000000d;border-radius:999px;flex:none;padding:2px 6px;font-size:9.5px;font-weight:600}._2AgH6G_delightCounter{color:var(--obc-text-muted);white-space:nowrap;flex:none;font-size:10px;font-weight:600}._2AgH6G_delightNav{width:26px;height:26px;color:var(--obc-brand-strong);cursor:pointer;background:#fffc;border:1px solid #fb729938;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;font-size:14px;font-weight:700;line-height:1;transition:background .15s,border-color .15s;display:inline-flex}._2AgH6G_delightNav:hover:not(:disabled){background:#fb729924;border-color:#fb729973}._2AgH6G_delightNav:disabled{opacity:.32;cursor:default}._2AgH6G_delightDismiss{width:26px;height:26px;color:var(--obc-text-secondary);cursor:pointer;background:#0000000a;border:0;border-left-width:medium;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;font-size:15px;line-height:1;transition:background .15s,color .15s;display:inline-flex}._2AgH6G_delightRow{cursor:pointer;text-align:left;min-width:0;color:inherit;background:0 0;border:0;align-items:center;gap:10px;padding:8px 10px 10px;display:flex}._2AgH6G_delightThumb{aspect-ratio:auto;object-fit:cover;background:linear-gradient(145deg,#fb72992e,#a855f71f);border:1px solid #ffffffeb;border-radius:10px;flex:none;width:104px;height:58px;box-shadow:inset 0 1px #ffffffb8,0 2px 8px #fb72991f}._2AgH6G_delightThumbFallback{aspect-ratio:auto;box-sizing:border-box;width:104px;height:58px;color:var(--obc-text-secondary);text-align:center;background:linear-gradient(145deg,#fb72992e,#a855f71f);border:1px solid #ffffffeb;border-radius:10px;flex:none;justify-content:center;align-items:center;padding:4px;font-size:9px;font-weight:700;line-height:1.4;display:flex;overflow:hidden;box-shadow:inset 0 1px #ffffffb8}._2AgH6G_delightText{flex:1;align-items:center;min-width:0;display:flex}._2AgH6G_delightTitle{min-width:0;color:var(--obc-text);-webkit-line-clamp:2;overflow-wrap:anywhere;-webkit-box-orient:vertical;font-size:12.5px;font-weight:700;line-height:1.55;display:-webkit-box;overflow:hidden}._2AgH6G_delightChevron{width:24px;height:24px;color:var(--obc-text-muted);cursor:pointer;background:#ffffffb3;border:0;border-radius:50%;flex:none;justify-content:center;align-items:center;font-size:10px;line-height:1;display:inline-flex}._2AgH6G_delightCard{background:radial-gradient(circle at 100% 0,#fb729924,#0000 38%),linear-gradient(#fffcfefa,#f6fafffa);border:1px solid #fb729947;border-radius:18px;flex-direction:column;flex-shrink:0;gap:0;padding:0;transition:border-color .2s,box-shadow .2s;display:flex;overflow:hidden;box-shadow:inset 0 1px #ffffffd1,0 4px 14px #fb72991a}._2AgH6G_delightCard:hover{border-color:#fb729980;box-shadow:inset 0 1px #ffffffd1,0 12px 28px #fb72992e}._2AgH6G_delightHeader{align-items:center;gap:7px;min-width:0;padding:10px 12px 2px;display:flex}._2AgH6G_delightMain{cursor:pointer;text-align:left;min-width:0;color:inherit;background:0 0;border:0;flex-direction:column;gap:8px;padding:4px 10px 10px;display:flex}._2AgH6G_delightCover{aspect-ratio:16/9;background:linear-gradient(#fffffffa,#fff8fcf0),linear-gradient(145deg,#fb72992e,#a855f71f);border:1px solid #ffffffeb;border-radius:14px;width:100%;transition:box-shadow .2s;display:block;position:relative;overflow:hidden;box-shadow:inset 0 1px #ffffffb8,0 2px 8px #fb72991f}._2AgH6G_delightCard:hover ._2AgH6G_delightCover{box-shadow:inset 0 1px #ffffffb8,0 8px 18px #fb729938}._2AgH6G_delightHero{object-fit:cover;width:100%;height:100%;transition:transform .35s;display:block}._2AgH6G_delightCard:hover ._2AgH6G_delightHero{transform:scale(1.03)}._2AgH6G_delightCover:before{content:\"✨\";width:27px;height:27px;color:var(--obc-brand-strong);text-align:center;pointer-events:none;z-index:2;background:#fffffff0;border-radius:999px;font-size:15px;line-height:27px;position:absolute;top:8px;left:8px;box-shadow:0 2px 8px #fb72994d}._2AgH6G_delightCoverScrim{pointer-events:none;z-index:1;background:linear-gradient(#0000,#141a2870);height:40%;position:absolute;inset:auto 0 0}._2AgH6G_delightScorePill{z-index:2;color:#fff;letter-spacing:.01em;background:linear-gradient(135deg,#fb7299f5,#e25885e6);border-radius:999px;padding:3px 10px;font-size:10.5px;font-weight:800;line-height:1.4;position:absolute;bottom:8px;left:8px;box-shadow:0 2px 8px #fb72995c}._2AgH6G_delightHeroFallback{box-sizing:border-box;width:100%;height:100%;min-height:96px;color:var(--obc-text-secondary);text-align:center;background:linear-gradient(145deg,#fb729924,#5aa9ff1a);justify-content:center;align-items:center;padding:12px 14px;font-size:11px;font-weight:700;line-height:1.55;display:flex;overflow:hidden}._2AgH6G_delightCover:has(._2AgH6G_delightHeroFallback){aspect-ratio:auto}._2AgH6G_delightTitleWrap{align-items:center;gap:8px;min-width:0;padding:0 2px;display:flex}._2AgH6G_delightTitle{min-width:0;color:var(--obc-text);-webkit-line-clamp:2;overflow-wrap:anywhere;-webkit-box-orient:vertical;flex:1;font-size:13px;font-weight:800;line-height:1.5;display:-webkit-box;overflow:hidden}._2AgH6G_delightCard[data-expanded=true] ._2AgH6G_delightTitle{-webkit-line-clamp:unset;display:block}._2AgH6G_delightChevron{width:24px;height:24px;color:var(--obc-text-muted);background:#ffffffb3;border:0;border-radius:8px;flex:none;justify-content:center;align-items:center;font-size:10px;line-height:1;display:inline-flex}._2AgH6G_delightDismiss{color:var(--obc-text-muted);cursor:pointer;background:0 0;border:0;border-left:1px solid #eddbe999;border-radius:0 8px 8px 0;padding:3px 7px;font-size:15px;line-height:1;transition:background .15s,color .15s}._2AgH6G_delightDismiss:hover:not(:disabled){color:var(--obc-danger);background:#ef7a861f}._2AgH6G_delightDismiss:disabled{cursor:wait;opacity:.58}._2AgH6G_delightBody{border-top:1px solid #eddbe999;flex-direction:column;gap:8px;padding:2px 12px 12px;display:flex}._2AgH6G_delightBody ._2AgH6G_delightReason{margin-top:8px}._2AgH6G_delightReason{color:var(--obc-text-secondary);background:#f0f6ffe6;border-radius:10px;padding:8px 10px;font-size:11.5px;line-height:1.6}._2AgH6G_delightScore{color:var(--obc-brand-strong);font-weight:800}._2AgH6G_delightActions{flex-wrap:wrap;gap:6px;display:flex}._2AgH6G_delightActions ._2AgH6G_actionButton{flex:1;min-width:0;padding:6px 8px;font-size:11.5px}._2AgH6G_delightComposer{align-items:flex-end;gap:6px;display:flex}._2AgH6G_delightComposer ._2AgH6G_chatInput{flex:1}._2AgH6G_settingsOverlay{z-index:12;backdrop-filter:blur(2px);background:#20304a47;flex-direction:column;justify-content:flex-start;display:flex;position:absolute;inset:0}._2AgH6G_settingsPanel{background:radial-gradient(circle at 15% 4%, #fb72991f, transparent 30%), var(--obc-bg);border-radius:18px 18px 0 0;flex-direction:column;flex:1;min-height:0;margin-top:8px;display:flex}._2AgH6G_settingsHeader{border-bottom:1px solid var(--obc-line);flex:none;justify-content:space-between;align-items:center;padding:14px 14px 10px;display:flex}._2AgH6G_settingsHeader h2{color:var(--obc-text);letter-spacing:-.02em;margin:0;font-size:15px;font-weight:800}._2AgH6G_settingsBack{width:30px;height:30px;color:var(--obc-text-secondary);cursor:pointer;background:#ffffffc2;border:1px solid #e6edf8eb;border-radius:10px;font-size:14px}._2AgH6G_settingsBack:hover{background:var(--obc-brand-soft);color:var(--obc-brand-strong)}._2AgH6G_settingsTabs{border-bottom:1px solid var(--obc-line);scrollbar-width:none;flex:none;gap:2px;padding:8px 10px 0;display:flex;overflow-x:auto}._2AgH6G_settingsTab{color:var(--obc-text-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:0;border-radius:8px 8px 0 0;padding:6px 10px 8px;font-size:11.5px;font-weight:700}._2AgH6G_settingsTab:hover{color:var(--obc-text);background:var(--obc-interactive-bg-hover,#ffffff80)}._2AgH6G_settingsTab[data-active=true]{color:var(--obc-brand-strong);box-shadow:inset 0 -2px 0 var(--obc-brand);font-weight:800}._2AgH6G_settingsBody{flex-direction:column;flex:1;gap:10px;min-height:0;padding:12px 14px 24px;display:flex;overflow-y:auto}._2AgH6G_settingsToastBar{color:var(--obc-success);background:#30b9801f;border:1px solid #30b9804d;border-radius:8px;flex:none;padding:7px 10px;font-size:11.5px}._2AgH6G_settingsSection{background:#fffffff0;border:1px solid #e7eef8f5;border-radius:16px;flex-direction:column;gap:10px;padding:12px 14px;display:flex}._2AgH6G_settingsSection h3{color:var(--obc-text);align-items:center;gap:6px;margin:0;font-size:13px;font-weight:800;display:flex}._2AgH6G_sectionIcon{font-size:14px}._2AgH6G_settingsField{flex-direction:column;gap:4px;display:flex}._2AgH6G_settingsField>label{color:var(--obc-text-secondary);font-size:11px;font-weight:700}._2AgH6G_settingsFieldRow{color:var(--obc-text);align-items:center;gap:8px;font-size:11.5px;display:flex}._2AgH6G_settingsFieldRow input[type=checkbox]{accent-color:var(--obc-brand)}._2AgH6G_settingsInput{box-sizing:border-box;width:100%;color:var(--obc-text);background:#ffffffe6;border:1px solid #e6edf8eb;border-radius:8px;padding:6px 9px;font-family:inherit;font-size:11.5px}._2AgH6G_settingsInput:focus{border-color:var(--obc-sky-blue);outline:none}._2AgH6G_settingsHint{color:var(--obc-text-muted);margin:0;font-size:10.5px;line-height:1.5}._2AgH6G_settingsActions{align-items:center;gap:8px;display:flex}._2AgH6G_settingsToast{color:var(--obc-success);font-size:11px}._2AgH6G_settingsInstance{border:1px solid var(--obc-line);background:#ffffffb3;border-radius:12px;flex-direction:column;gap:8px;padding:10px 11px;display:flex}._2AgH6G_settingsInstanceHead{color:var(--obc-text);justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:800;display:flex}._2AgH6G_settingsSavebar{border:1px solid var(--obc-line);backdrop-filter:blur(14px);box-shadow:var(--obc-shadow-sm);background:#ffffffd1;border-radius:14px;justify-content:flex-end;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;display:flex;position:sticky;bottom:0}._2AgH6G_settingsSavebarMsg{color:var(--obc-text-muted);flex:1;font-size:11px}._2AgH6G_probeStatus{color:var(--obc-text-muted);word-break:break-word;font-size:11px;line-height:1.5}._2AgH6G_probeStatus[data-tone=success]{color:var(--obc-success)}._2AgH6G_probeStatus[data-tone=error]{color:var(--obc-danger)}._2AgH6G_llmInstanceList{flex-direction:column;gap:8px;display:flex}._2AgH6G_llmInstance{border:1px solid var(--obc-line);background:#ffffffb3;border-radius:12px;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;display:flex}._2AgH6G_llmInstanceMain{flex-direction:column;gap:3px;min-width:0;display:flex}._2AgH6G_llmInstanceHead{flex-wrap:wrap;align-items:center;gap:6px;display:flex}._2AgH6G_llmInstanceName{color:var(--obc-text);font-size:12px;font-weight:800}._2AgH6G_llmBadge{background:var(--obc-brand-soft);color:var(--obc-brand-strong);border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;line-height:1}._2AgH6G_llmBadge[data-tone=off]{color:var(--obc-text-muted);background:#8290a829}._2AgH6G_llmInstanceDetail{color:var(--obc-text-muted);text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;overflow:hidden}._2AgH6G_llmInstanceActions{flex:none;gap:6px;display:flex}._2AgH6G_chainSection{border-top:1px dashed var(--obc-line);flex-direction:column;gap:8px;margin-top:10px;padding-top:10px;display:flex}._2AgH6G_chainHead{justify-content:space-between;align-items:center;gap:8px;display:flex}._2AgH6G_chainHead h4{color:var(--obc-text);margin:0;font-size:11.5px;font-weight:800}._2AgH6G_chainEditor{flex-direction:column;gap:6px;display:flex}._2AgH6G_chainList{flex-direction:column;gap:4px;display:flex}._2AgH6G_chainRow{border:1px solid var(--obc-line);background:#ffffff9e;border-radius:10px;align-items:center;gap:4px;padding:5px 8px;display:flex}._2AgH6G_chainName{min-width:0;color:var(--obc-text);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:11px;font-weight:700;overflow:hidden}._2AgH6G_chainBtn{border:1px solid var(--obc-line);width:22px;height:22px;color:var(--obc-text-muted);cursor:pointer;background:#ffffffb3;border-radius:7px;flex:none;justify-content:center;align-items:center;font-size:10px;line-height:1;display:inline-flex}._2AgH6G_chainBtn:hover:not(:disabled){color:var(--obc-brand-strong);border-color:var(--obc-brand)}._2AgH6G_chainBtn:disabled{opacity:.35;cursor:default}._2AgH6G_chainPicker{align-items:center;gap:6px;display:flex}._2AgH6G_chainPicker ._2AgH6G_settingsInput{flex:1;min-width:0}._2AgH6G_moduleRoute{border:1px solid var(--obc-line);background:#ffffff9e;border-radius:12px;margin-bottom:8px;padding:8px 10px}._2AgH6G_dialogOverlay{backdrop-filter:blur(3px);z-index:60;background:#141a286b;justify-content:center;align-items:flex-start;padding:6vh 14px;display:flex;position:fixed;inset:0}._2AgH6G_dialogCard{border:1px solid var(--obc-line);background:var(--obc-bg);width:min(460px,100%);max-height:86vh;box-shadow:var(--obc-shadow-lg);border-radius:16px;flex-direction:column;gap:10px;padding:14px;display:flex;overflow-y:auto}._2AgH6G_dialogHead{justify-content:space-between;align-items:center;gap:8px;display:flex}._2AgH6G_dialogHead h3{color:var(--obc-text);margin:0;font-size:13px;font-weight:800}._2AgH6G_dialogFields{flex-direction:column;gap:8px;display:flex}._2AgH6G_dialogActionRow{align-items:center;gap:6px;display:flex}._2AgH6G_dialogActionRow ._2AgH6G_settingsInput{flex:1;min-width:0}._2AgH6G_dialogActions{border-top:1px solid var(--obc-line);flex-wrap:wrap;align-items:center;gap:8px;padding-top:10px;display:flex}._2AgH6G_dialogActions ._2AgH6G_probeStatus{flex:100%;order:-1}._2AgH6G_updateRow{color:var(--obc-text-secondary);justify-content:space-between;align-items:baseline;gap:10px;padding:4px 0;font-size:11.5px;display:flex}._2AgH6G_updateRow strong{color:var(--obc-text);word-break:break-word;text-align:right;font-weight:800}._2AgH6G_panel[data-dark=true]{--obc-bg:#15161a;--obc-sky:#0f1115;--obc-surface:#24262ce0;--obc-surface-strong:#282a31f7;--obc-surface-soft:#212329d1;--obc-line:#ffffff14;--obc-line-strong:#fb729959;--obc-text:#e9ebf1;--obc-text-secondary:#b0b9ca;--obc-text-muted:#8c97ad;--obc-brand-soft:#fb729929;--obc-sky-soft:#5aa9ff29;--obc-shadow-lg:0 20px 40px #00000073;--obc-shadow-sm:0 10px 22px #00000059;background:radial-gradient(circle at 15% 8%,#fb72991a,#0000 30%),radial-gradient(circle at 88% 12%,#5aa9ff1a,#0000 26%),linear-gradient(#17181d 0%,#101216 100%)}._2AgH6G_panel[data-dark=true] ._2AgH6G_iconButton,._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsBack{color:var(--obc-text-secondary);background:#ffffff0f;border-color:#ffffff1a}._2AgH6G_panel[data-dark=true] ._2AgH6G_iconButton:hover,._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsBack:hover{background:var(--obc-brand-soft);color:var(--obc-brand-strong)}._2AgH6G_panel[data-dark=true] ._2AgH6G_tab:hover{background:#ffffff0f}._2AgH6G_panel[data-dark=true] ._2AgH6G_tab[data-active=true]{background:linear-gradient(#ffffff1a,#fb729924);box-shadow:0 10px 18px #0000004d}._2AgH6G_panel[data-dark=true] ._2AgH6G_recHeader,._2AgH6G_panel[data-dark=true] ._2AgH6G_card,._2AgH6G_panel[data-dark=true] ._2AgH6G_recCard,._2AgH6G_panel[data-dark=true] ._2AgH6G_profileGroup,._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsSection,._2AgH6G_panel[data-dark=true] ._2AgH6G_dialogueCard,._2AgH6G_panel[data-dark=true] ._2AgH6G_insightCard,._2AgH6G_panel[data-dark=true] ._2AgH6G_probe,._2AgH6G_panel[data-dark=true] ._2AgH6G_footerItem{box-shadow:none;background:linear-gradient(#26282feb,#21232aeb);border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_card:hover,._2AgH6G_panel[data-dark=true] ._2AgH6G_recCard:hover{border-color:#fb729973;box-shadow:0 14px 26px #0006}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightCard{background:radial-gradient(circle at 100% 0,#fb72991f,#0000 38%),linear-gradient(#2c242cf7,#1e222cf7);border-color:#fb72994d;box-shadow:inset 0 1px #ffffff0d,0 4px 14px #0000004d}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightCard:hover{border-color:#fb72998c;box-shadow:inset 0 1px #ffffff0d,0 12px 28px #0006}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightKicker,._2AgH6G_panel[data-dark=true] ._2AgH6G_topicBadge,._2AgH6G_panel[data-dark=true] ._2AgH6G_chip[data-tone=brand]{background:#fb729929}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightPlatform,._2AgH6G_panel[data-dark=true] ._2AgH6G_stateBadge,._2AgH6G_panel[data-dark=true] ._2AgH6G_platformTag,._2AgH6G_panel[data-dark=true] ._2AgH6G_poolChip,._2AgH6G_panel[data-dark=true] ._2AgH6G_chip,._2AgH6G_panel[data-dark=true] ._2AgH6G_contextBadge{color:var(--obc-text-secondary);background:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightNav,._2AgH6G_panel[data-dark=true] ._2AgH6G_delightChevron,._2AgH6G_panel[data-dark=true] ._2AgH6G_footerToggle,._2AgH6G_panel[data-dark=true] ._2AgH6G_pendingOpen,._2AgH6G_panel[data-dark=true] ._2AgH6G_contextClear{background:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_actionButton{color:var(--obc-text-secondary);background:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_actionButton:hover:not(:disabled){color:var(--obc-text);background:#ffffff1f}._2AgH6G_panel[data-dark=true] ._2AgH6G_savedToggle{color:var(--obc-text-secondary);background:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsInput,._2AgH6G_panel[data-dark=true] ._2AgH6G_commentInput,._2AgH6G_panel[data-dark=true] ._2AgH6G_chatInput,._2AgH6G_panel[data-dark=true] ._2AgH6G_commentComposer textarea{color:var(--obc-text);background:#181a1fe6;border-color:#ffffff1a}._2AgH6G_panel[data-dark=true] ._2AgH6G_turnSoul,._2AgH6G_panel[data-dark=true] ._2AgH6G_questionObservation{background:#ffffff0f;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_turnUser{background:#fb729933}._2AgH6G_panel[data-dark=true] ._2AgH6G_profileSummary{background:#242028f0;border-color:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_awarenessItem{background:#28241ef0;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_questionCard{background:linear-gradient(135deg,#1a2433,#141d2c);border-color:#3b82f659}._2AgH6G_panel[data-dark=true] ._2AgH6G_messageCard[data-tone=interest]{background:linear-gradient(135deg,#2b2418,#241d12);border-color:#dd7f2d66}._2AgH6G_panel[data-dark=true] ._2AgH6G_messageCard[data-tone=avoidance]{background:linear-gradient(135deg,#141f2e,#101a26);border-color:#3b82f666}._2AgH6G_panel[data-dark=true] ._2AgH6G_messageCard[data-tone=challenge]{background:linear-gradient(135deg,#221d33,#1b1728);border-color:#7c3aed66}._2AgH6G_panel[data-dark=true] ._2AgH6G_messageCard[data-tone=delight]{background:linear-gradient(135deg,#2e1f26,#261a20);border-color:#fb729966}._2AgH6G_panel[data-dark=true] ._2AgH6G_probe[data-tone=interest]{background:linear-gradient(135deg,#2b2418,#241d12);border-color:#dd7f2d66}._2AgH6G_panel[data-dark=true] ._2AgH6G_probe[data-tone=avoidance]{background:linear-gradient(135deg,#141f2e,#101a26);border-color:#3b82f666}._2AgH6G_panel[data-dark=true] ._2AgH6G_messageBody{color:#b4bece}._2AgH6G_panel[data-dark=true] ._2AgH6G_mbtiDimBar,._2AgH6G_panel[data-dark=true] ._2AgH6G_barTrack,._2AgH6G_panel[data-dark=true] ._2AgH6G_insightConfidenceBar,._2AgH6G_panel[data-dark=true] ._2AgH6G_mbtiConfidence{background:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_drawerPanel,._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsPanel{background:radial-gradient(circle at 15% 4%,#fb729914,#0000 30%),#15161a}._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsInstance{background:#ffffff0a;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_pendingItem{border-top-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_contextBar,._2AgH6G_panel[data-dark=true] ._2AgH6G_activityFooter{background:#212329d9;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_subTabs{background:#ffffff0a;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_subTab[data-active=true]{background:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightReason{color:var(--obc-text-secondary);background:#ffffff0f}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightBody{border-top-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightChevron{color:var(--obc-text-secondary);background:#ffffff12}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightDismiss{border-left-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_footerHint{color:#c3cddd}._2AgH6G_panel[data-dark=true] ._2AgH6G_settingsSavebar,._2AgH6G_panel[data-dark=true] ._2AgH6G_llmInstance,._2AgH6G_panel[data-dark=true] ._2AgH6G_chainRow,._2AgH6G_panel[data-dark=true] ._2AgH6G_moduleRoute{background:#24262ce0;border-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_chainBtn{background:#ffffff0f;border-color:#ffffff1a}._2AgH6G_panel[data-dark=true] ._2AgH6G_dialogCard{background:radial-gradient(circle at 15% 4%,#fb729914,#0000 30%),#15161a;border-color:#ffffff1a}._2AgH6G_panel[data-dark=true] ._2AgH6G_llmBadge{background:#fb729933}._2AgH6G_panel[data-dark=true] ._2AgH6G_actionButton:disabled{opacity:.66;color:#9aa4b8}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightCover{background:linear-gradient(#282a31f5,#212329f5),linear-gradient(145deg,#fb729929,#5aa9ff1a);border-color:#ffffff24;box-shadow:inset 0 1px #ffffff0f,0 2px 8px #0000004d}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightCard:hover ._2AgH6G_delightCover{box-shadow:inset 0 1px #ffffff0f,0 8px 18px #0000006b}._2AgH6G_panel[data-dark=true] ._2AgH6G_delightHeroFallback{background:linear-gradient(145deg,#fb729929,#5aa9ff1f)}._2AgH6G_panel[data-dark=true] ._2AgH6G_pinnedFooter{background:#15161ab3;border-top-color:#ffffff14}._2AgH6G_panel[data-dark=true] ._2AgH6G_pinnedFooter ._2AgH6G_activityFooter{box-shadow:none;background:0 0;border:0}";
		const tagId = "@openbiliclaw/dsh-plugin/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@openbiliclaw/dsh-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"delightScorePill": "_2AgH6G_delightScorePill",
			"chainRow": "_2AgH6G_chainRow",
			"profilePortraitP": "_2AgH6G_profilePortraitP",
			"recTitle": "_2AgH6G_recTitle",
			"awarenessTrend": "_2AgH6G_awarenessTrend",
			"dialogueEvidence": "_2AgH6G_dialogueEvidence",
			"settingsSavebarMsg": "_2AgH6G_settingsSavebarMsg",
			"stateBadge": "_2AgH6G_stateBadge",
			"pinnedFooter": "_2AgH6G_pinnedFooter",
			"barRow": "_2AgH6G_barRow",
			"delightCover": "_2AgH6G_delightCover",
			"commentRow": "_2AgH6G_commentRow",
			"subTabs": "_2AgH6G_subTabs",
			"questionObservation": "_2AgH6G_questionObservation",
			"pendingKind": "_2AgH6G_pendingKind",
			"profileGroup": "_2AgH6G_profileGroup",
			"drawerEmptySubtitle": "_2AgH6G_drawerEmptySubtitle",
			"contextClear": "_2AgH6G_contextClear",
			"chatSend": "_2AgH6G_chatSend",
			"contextObservation": "_2AgH6G_contextObservation",
			"settingsSavebar": "_2AgH6G_settingsSavebar",
			"profileLayer": "_2AgH6G_profileLayer",
			"delightHeader": "_2AgH6G_delightHeader",
			"barPct": "_2AgH6G_barPct",
			"settingsTab": "_2AgH6G_settingsTab",
			"insightConfidenceLabel": "_2AgH6G_insightConfidenceLabel",
			"tabBar": "_2AgH6G_tabBar",
			"delightActions": "_2AgH6G_delightActions",
			"llmInstanceHead": "_2AgH6G_llmInstanceHead",
			"chainName": "_2AgH6G_chainName",
			"recBody": "_2AgH6G_recBody",
			"footerItemMeta": "_2AgH6G_footerItemMeta",
			"insightConfidenceFill": "_2AgH6G_insightConfidenceFill",
			"dialogueCard": "_2AgH6G_dialogueCard",
			"delightTitle": "_2AgH6G_delightTitle",
			"delightCounter": "_2AgH6G_delightCounter",
			"dialogHead": "_2AgH6G_dialogHead",
			"messagePrompt": "_2AgH6G_messagePrompt",
			"coverWrap": "_2AgH6G_coverWrap",
			"insightEvidence": "_2AgH6G_insightEvidence",
			"recHeaderCopy": "_2AgH6G_recHeaderCopy",
			"settingsBody": "_2AgH6G_settingsBody",
			"llmInstance": "_2AgH6G_llmInstance",
			"sectionIcon": "_2AgH6G_sectionIcon",
			"badge": "_2AgH6G_badge",
			"savedToggle": "_2AgH6G_savedToggle",
			"activityFooter": "_2AgH6G_activityFooter",
			"footerToggle": "_2AgH6G_footerToggle",
			"insightConfidenceRow": "_2AgH6G_insightConfidenceRow",
			"brand": "_2AgH6G_brand",
			"feedbackStatus": "_2AgH6G_feedbackStatus",
			"actionButton": "_2AgH6G_actionButton",
			"footerHistory": "_2AgH6G_footerHistory",
			"spacer": "_2AgH6G_spacer",
			"replyQuote": "_2AgH6G_replyQuote",
			"awarenessDate": "_2AgH6G_awarenessDate",
			"turnStatus": "_2AgH6G_turnStatus",
			"footerItemKind": "_2AgH6G_footerItemKind",
			"settingsHeader": "_2AgH6G_settingsHeader",
			"chipRow": "_2AgH6G_chipRow",
			"chip": "_2AgH6G_chip",
			"cardMeta": "_2AgH6G_cardMeta",
			"expression": "_2AgH6G_expression",
			"insightEvidenceList": "_2AgH6G_insightEvidenceList",
			"dialogActions": "_2AgH6G_dialogActions",
			"spinner": "_2AgH6G_spinner",
			"messageType": "_2AgH6G_messageType",
			"iconButton": "_2AgH6G_iconButton",
			"delightCoverScrim": "_2AgH6G_delightCoverScrim",
			"awarenessObservation": "_2AgH6G_awarenessObservation",
			"barLabel": "_2AgH6G_barLabel",
			"awarenessItemDate": "_2AgH6G_awarenessItemDate",
			"toolbar": "_2AgH6G_toolbar",
			"settingsInstance": "_2AgH6G_settingsInstance",
			"body": "_2AgH6G_body",
			"chatInputRow": "_2AgH6G_chatInputRow",
			"delightMain": "_2AgH6G_delightMain",
			"llmInstanceActions": "_2AgH6G_llmInstanceActions",
			"pendingInterpretation": "_2AgH6G_pendingInterpretation",
			"chainPicker": "_2AgH6G_chainPicker",
			"error": "_2AgH6G_error",
			"insightValidated": "_2AgH6G_insightValidated",
			"settingsHint": "_2AgH6G_settingsHint",
			"dialogueTitle": "_2AgH6G_dialogueTitle",
			"profilePhaseCopy": "_2AgH6G_profilePhaseCopy",
			"settingsInstanceHead": "_2AgH6G_settingsInstanceHead",
			"cardTitle": "_2AgH6G_cardTitle",
			"coverCorner": "_2AgH6G_coverCorner",
			"settingsInput": "_2AgH6G_settingsInput",
			"messageTitle": "_2AgH6G_messageTitle",
			"confirmItem": "_2AgH6G_confirmItem",
			"chainHead": "_2AgH6G_chainHead",
			"mbtiDimPct": "_2AgH6G_mbtiDimPct",
			"interestDomainHeader": "_2AgH6G_interestDomainHeader",
			"card": "_2AgH6G_card",
			"confirmTitle": "_2AgH6G_confirmTitle",
			"delightComposer": "_2AgH6G_delightComposer",
			"footerHead": "_2AgH6G_footerHead",
			"settingsTabs": "_2AgH6G_settingsTabs",
			"mbtiDimRow": "_2AgH6G_mbtiDimRow",
			"contextBarHead": "_2AgH6G_contextBarHead",
			"delightKickerLine": "_2AgH6G_delightKickerLine",
			"subTab": "_2AgH6G_subTab",
			"bellBadge": "_2AgH6G_bellBadge",
			"footerCopy": "_2AgH6G_footerCopy",
			"probeConfidence": "_2AgH6G_probeConfidence",
			"pendingConfidence": "_2AgH6G_pendingConfidence",
			"drawerPanel": "_2AgH6G_drawerPanel",
			"action_discuss": "_2AgH6G_action_discuss",
			"contextLabel": "_2AgH6G_contextLabel",
			"delightHeroFallback": "_2AgH6G_delightHeroFallback",
			"chipWeight": "_2AgH6G_chipWeight",
			"probeHead": "_2AgH6G_probeHead",
			"delightDismiss": "_2AgH6G_delightDismiss",
			"activityRow": "_2AgH6G_activityRow",
			"delightKicker": "_2AgH6G_delightKicker",
			"brandTitle": "_2AgH6G_brandTitle",
			"cardTurn": "_2AgH6G_cardTurn",
			"action_reject": "_2AgH6G_action_reject",
			"awarenessRow": "_2AgH6G_awarenessRow",
			"status": "_2AgH6G_status",
			"thumb": "_2AgH6G_thumb",
			"probeDomain": "_2AgH6G_probeDomain",
			"delightPlatform": "_2AgH6G_delightPlatform",
			"messageActions": "_2AgH6G_messageActions",
			"settingsFieldRow": "_2AgH6G_settingsFieldRow",
			"settingsPanel": "_2AgH6G_settingsPanel",
			"dialogActionRow": "_2AgH6G_dialogActionRow",
			"poolChipLabel": "_2AgH6G_poolChipLabel",
			"probe": "_2AgH6G_probe",
			"panel": "_2AgH6G_panel",
			"delightNav": "_2AgH6G_delightNav",
			"footerHeadline": "_2AgH6G_footerHeadline",
			"recHeader": "_2AgH6G_recHeader",
			"drawerHeader": "_2AgH6G_drawerHeader",
			"drawerEmptyTitle": "_2AgH6G_drawerEmptyTitle",
			"chainEditor": "_2AgH6G_chainEditor",
			"watchToggle": "_2AgH6G_watchToggle",
			"profileSummary": "_2AgH6G_profileSummary",
			"awarenessItem": "_2AgH6G_awarenessItem",
			"delightHero": "_2AgH6G_delightHero",
			"delightThumb": "_2AgH6G_delightThumb",
			"mbtiConfidence": "_2AgH6G_mbtiConfidence",
			"cardActions": "_2AgH6G_cardActions",
			"profileCard": "_2AgH6G_profileCard",
			"moduleRoute": "_2AgH6G_moduleRoute",
			"poolChip": "_2AgH6G_poolChip",
			"topicBadge": "_2AgH6G_topicBadge",
			"statusDot": "_2AgH6G_statusDot",
			"interestTree": "_2AgH6G_interestTree",
			"llmInstanceDetail": "_2AgH6G_llmInstanceDetail",
			"commentComposer": "_2AgH6G_commentComposer",
			"recCover": "_2AgH6G_recCover",
			"insightConfidenceBar": "_2AgH6G_insightConfidenceBar",
			"contextBar": "_2AgH6G_contextBar",
			"delightCard": "_2AgH6G_delightCard",
			"insightCard": "_2AgH6G_insightCard",
			"brandCopy": "_2AgH6G_brandCopy",
			"confirmCount": "_2AgH6G_confirmCount",
			"insightNote": "_2AgH6G_insightNote",
			"awarenessEmotion": "_2AgH6G_awarenessEmotion",
			"loadMore": "_2AgH6G_loadMore",
			"messageCard": "_2AgH6G_messageCard",
			"interestDomainWeight": "_2AgH6G_interestDomainWeight",
			"header": "_2AgH6G_header",
			"probeReason": "_2AgH6G_probeReason",
			"interestDomain": "_2AgH6G_interestDomain",
			"viewKicker": "_2AgH6G_viewKicker",
			"llmInstanceList": "_2AgH6G_llmInstanceList",
			"contextBadge": "_2AgH6G_contextBadge",
			"probeStatus": "_2AgH6G_probeStatus",
			"turnSoul": "_2AgH6G_turnSoul",
			"contextRow": "_2AgH6G_contextRow",
			"recKicker": "_2AgH6G_recKicker",
			"insightTitle": "_2AgH6G_insightTitle",
			"barTrack": "_2AgH6G_barTrack",
			"awarenessHeader": "_2AgH6G_awarenessHeader",
			"dialogOverlay": "_2AgH6G_dialogOverlay",
			"obcSpin": "_2AgH6G_obcSpin",
			"footerItem": "_2AgH6G_footerItem",
			"starToggle": "_2AgH6G_starToggle",
			"delightReason": "_2AgH6G_delightReason",
			"settingsToastBar": "_2AgH6G_settingsToastBar",
			"statusText": "_2AgH6G_statusText",
			"delightRow": "_2AgH6G_delightRow",
			"dialogueActions": "_2AgH6G_dialogueActions",
			"loadingRow": "_2AgH6G_loadingRow",
			"hint": "_2AgH6G_hint",
			"stats": "_2AgH6G_stats",
			"pendingOpen": "_2AgH6G_pendingOpen",
			"viewIntro": "_2AgH6G_viewIntro",
			"interestTreeLabel": "_2AgH6G_interestTreeLabel",
			"footerHint": "_2AgH6G_footerHint",
			"dialogueAction": "_2AgH6G_dialogueAction",
			"mbtiDimBar": "_2AgH6G_mbtiDimBar",
			"settingsField": "_2AgH6G_settingsField",
			"footerItemSummary": "_2AgH6G_footerItemSummary",
			"questionCard": "_2AgH6G_questionCard",
			"settings": "_2AgH6G_settings",
			"pendingObservation": "_2AgH6G_pendingObservation",
			"settingsActions": "_2AgH6G_settingsActions",
			"delightText": "_2AgH6G_delightText",
			"platformTag": "_2AgH6G_platformTag",
			"dialogueState": "_2AgH6G_dialogueState",
			"contextTitle": "_2AgH6G_contextTitle",
			"dialogCard": "_2AgH6G_dialogCard",
			"tab": "_2AgH6G_tab",
			"cardBody": "_2AgH6G_cardBody",
			"mbtiTypeLabel": "_2AgH6G_mbtiTypeLabel",
			"contextValue": "_2AgH6G_contextValue",
			"chainList": "_2AgH6G_chainList",
			"settingsToast": "_2AgH6G_settingsToast",
			"poolChips": "_2AgH6G_poolChips",
			"activityLine": "_2AgH6G_activityLine",
			"dialogFields": "_2AgH6G_dialogFields",
			"contextInterpretation": "_2AgH6G_contextInterpretation",
			"mbtiDimBarFill": "_2AgH6G_mbtiDimBarFill",
			"confirmToggle": "_2AgH6G_confirmToggle",
			"sectionTitle": "_2AgH6G_sectionTitle",
			"delightThumbFallback": "_2AgH6G_delightThumbFallback",
			"updateRow": "_2AgH6G_updateRow",
			"chatInput": "_2AgH6G_chatInput",
			"delightChevron": "_2AgH6G_delightChevron",
			"settingsBack": "_2AgH6G_settingsBack",
			"dialogueKicker": "_2AgH6G_dialogueKicker",
			"recCoverText": "_2AgH6G_recCoverText",
			"thumbFallback": "_2AgH6G_thumbFallback",
			"messageBody": "_2AgH6G_messageBody",
			"turnUser": "_2AgH6G_turnUser",
			"questionInterpretation": "_2AgH6G_questionInterpretation",
			"badgeRow": "_2AgH6G_badgeRow",
			"confirmPanel": "_2AgH6G_confirmPanel",
			"brandMark": "_2AgH6G_brandMark",
			"turn": "_2AgH6G_turn",
			"settingsSection": "_2AgH6G_settingsSection",
			"interestDomainName": "_2AgH6G_interestDomainName",
			"pendingItem": "_2AgH6G_pendingItem",
			"llmBadge": "_2AgH6G_llmBadge",
			"drawerOverlay": "_2AgH6G_drawerOverlay",
			"poolChipValue": "_2AgH6G_poolChipValue",
			"activityTime": "_2AgH6G_activityTime",
			"barFill": "_2AgH6G_barFill",
			"mbtiDimensions": "_2AgH6G_mbtiDimensions",
			"delightScore": "_2AgH6G_delightScore",
			"awarenessList": "_2AgH6G_awarenessList",
			"probeActions": "_2AgH6G_probeActions",
			"pendingCopy": "_2AgH6G_pendingCopy",
			"recCard": "_2AgH6G_recCard",
			"mbtiContainer": "_2AgH6G_mbtiContainer",
			"domainWeight": "_2AgH6G_domainWeight",
			"recHeaderTitle": "_2AgH6G_recHeaderTitle",
			"settingsOverlay": "_2AgH6G_settingsOverlay",
			"mbtiDimPole": "_2AgH6G_mbtiDimPole",
			"commentInput": "_2AgH6G_commentInput",
			"mbtiTypeRow": "_2AgH6G_mbtiTypeRow",
			"llmInstanceName": "_2AgH6G_llmInstanceName",
			"chainBtn": "_2AgH6G_chainBtn",
			"delightBody": "_2AgH6G_delightBody",
			"portrait": "_2AgH6G_portrait",
			"drawerEmpty": "_2AgH6G_drawerEmpty",
			"chainSection": "_2AgH6G_chainSection",
			"interestDomainHead": "_2AgH6G_interestDomainHead",
			"drawerTitle": "_2AgH6G_drawerTitle",
			"llmInstanceMain": "_2AgH6G_llmInstanceMain",
			"delightTitleWrap": "_2AgH6G_delightTitleWrap",
			"insightHead": "_2AgH6G_insightHead",
			"empty": "_2AgH6G_empty",
			"action_confirm": "_2AgH6G_action_confirm",
			"settingsRow": "_2AgH6G_settingsRow"
		};
		//#endregion
		//#region lib/types/client/views.js
		/**
		* Shared card pieces plus the 推荐 (recommend) view — mirroring the canonical
		* OpenBiliClaw surfaces (mobile web + extension popup): header card with
		* 换一批, pool status chips, delight banner, recommendation cards with the
		* full action set (去看看/多来点/稍后再看/收藏/少来点/评论), and the
		* expandable activity footer.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Canonical platform display names (same map as the popup). */
		function platformLabel(platform) {
			return {
				bilibili: "B站",
				xiaohongshu: "小红书",
				douyin: "抖音",
				weibo: "微博",
				youtube: "YouTube",
				twitter: "X",
				x: "X",
				zhihu: "知乎",
				reddit: "Reddit",
				bangumi: "Bangumi",
				linuxdo: "Linux.do",
				v2ex: "V2EX"
			}[(platform || "bilibili").toLowerCase()] ?? platform ?? "B站";
		}
		/** Format a raw count into a compact display number. */
		function formatCount(value) {
			if (value >= 1e9) return `${(value / 1e9).toFixed(1)}亿`;
			if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
			if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
			return String(value);
		}
		/** Small cover thumbnail with an optional platform corner label. */
		function Thumb(props) {
			const media = props.url !== "" ? (0, react_jsx_runtime.jsx)("img", {
				className: panel_module_css_default.thumb,
				src: props.url,
				alt: "",
				loading: "lazy",
				referrerPolicy: "no-referrer"
			}) : (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.thumbFallback,
				children: props.kind === "text" ? "📄" : "🎬"
			});
			if (props.platform !== void 0 && props.platform !== "") return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.coverWrap,
				children: [media, (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.coverCorner,
					children: platformLabel(props.platform)
				})]
			});
			return media;
		}
		/** Platform tag + author/time meta row. */
		function MetaRow(props) {
			const parts = [];
			if (props.author !== void 0 && props.author !== "") parts.push((0, react_jsx_runtime.jsx)("span", { children: props.author }, "a"));
			if (props.time !== void 0 && props.time !== "") parts.push((0, react_jsx_runtime.jsx)("span", { children: formatTime(props.time) }, "t"));
			if (parts.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.cardMeta,
				children: parts
			});
		}
		/** Compact timestamp formatter. */
		function formatTime(iso) {
			if (iso === "") return "";
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
			const diff = Date.now() - date.getTime();
			if (diff < 36e5) return `${Math.max(1, Math.floor(diff / 6e4))} 分钟前`;
			if (diff < 864e5) return `${Math.floor(diff / 36e5)} 小时前`;
			if (diff < 2592e6) return `${Math.floor(diff / 864e5)} 天前`;
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		}
		/** Engagement stats row. */
		function StatsRow(props) {
			const { item } = props;
			const parts = [];
			if (item.view_count > 0) parts.push(["▶", item.view_count]);
			if (item.danmaku_count > 0) parts.push(["💬", item.danmaku_count]);
			if (item.like_count > 0) parts.push(["👍", item.like_count]);
			if (item.favorite_count > 0) parts.push(["⭐", item.favorite_count]);
			if (item.comment_count > 0) parts.push(["✎", item.comment_count]);
			if (item.share_count > 0) parts.push(["↗", item.share_count]);
			if (parts.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.stats,
				children: parts.map(([icon, count]) => (0, react_jsx_runtime.jsxs)("span", { children: [
					icon,
					" ",
					formatCount(count)
				] }, icon))
			});
		}
		/** Small action button. */
		function ActionButton(props) {
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: panel_module_css_default.actionButton,
				"data-primary": props.primary === true || void 0,
				"data-danger": props.danger === true || void 0,
				disabled: props.disabled === true,
				title: props.title,
				onClick: props.onClick,
				children: props.label
			});
		}
		/** Empty state line. */
		function EmptyState(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.empty,
				children: props.text
			});
		}
		/** Error note. */
		function ErrorNote(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.error,
				children: props.text
			});
		}
		/** Stable idempotency key per (item identity × action): reuse on retries only. */
		function useActionId(identity, action) {
			const ref = (0, react.useRef)(/* @__PURE__ */ new Map());
			const key = `${identity}::${action}`;
			let id = ref.current.get(key);
			if (id === void 0) {
				id = stableId();
				ref.current.set(key, id);
			}
			return id;
		}
		/** Open a content URL (recording the click first, never blocking the open). */
		function openItem(base, item) {
			const url = item.content_url !== "" ? item.content_url : item.bvid !== "" ? `https://www.bilibili.com/video/${item.bvid}` : "";
			if (url === "") return;
			reportClick(base, {
				recommendation_id: item.recommendation_id,
				content_id: item.content_id !== "" ? item.content_id : item.bvid,
				content_url: item.content_url,
				source_platform: item.source_platform,
				title: item.title,
				request_id: stableId()
			}).catch(() => {});
			window.open(url, "_blank", "noopener");
		}
		/** Pool status chips, mirroring the popup's getPoolStatusSummary language. */
		function poolStatus(status) {
			if (status === null) return [];
			const available = status.pool_available_count;
			const replenished = typeof status.last_replenished_count === "number" ? status.last_replenished_count : 0;
			const pending = status.pool_pending_count;
			const topics = Array.isArray(status.recent_pool_topics) ? status.recent_pool_topics : [];
			if (pending > 0 && available === 0) return [{
				label: "可换",
				value: `找到 ${pending} 条素材，正在整理成可换内容`
			}, {
				label: "补货",
				value: "整理好就能换"
			}];
			const poolSufficient = available >= (status.pool_target_count || 0);
			return [
				{
					label: "可换",
					value: `还有 ${available} 条可换`
				},
				{
					label: "补货",
					value: replenished > 0 ? `刚补进 ${replenished} 条` : pending > 0 ? `另有 ${pending} 条素材` : poolSufficient ? "这会儿先不补货" : "这轮还没补进"
				},
				{
					label: "状态",
					value: topics.length > 0 ? topics.join(" / ") : poolSufficient ? "先把这一池给你慢慢换开" : "还在继续摸你的口味"
				}
			];
		}
		/** One recommendation card (canonical action set incl. comment composer). */
		function RecommendationCard({ base, item, onDismissed, onError }) {
			const likeId = useActionId(String(item.id), "like");
			const dislikeId = useActionId(String(item.id), "dislike");
			const dismissId = useActionId(String(item.id), "dismiss");
			const [busy, setBusy] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("");
			const [statusTone, setStatusTone] = (0, react.useState)("info");
			const [comment, setComment] = (0, react.useState)("");
			const [composerOpen, setComposerOpen] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const key = item.item_key !== "" ? item.item_key : item.bvid;
				if (key === "") return;
				Promise.all([fetchSavedStatus(base, "favorite", key).catch(() => false), fetchSavedStatus(base, "watch_later", key).catch(() => false)]).then(([favorite, watch_later]) => {
					if (!cancelled) setSaved({
						favorite,
						watch_later
					});
				});
				return () => {
					cancelled = true;
				};
			}, [
				base,
				item.item_key,
				item.bvid
			]);
			const act = (0, react.useCallback)(async (action, run, done = "", doneTone = "info") => {
				setBusy(action);
				setStatus("提交中…");
				setStatusTone("info");
				try {
					await run();
					setStatus(done);
					setStatusTone(doneTone);
				} catch (err) {
					setStatus("没记上：" + (err instanceof Error ? err.message : String(err)));
					setStatusTone("error");
				} finally {
					setBusy(null);
				}
			}, []);
			const feedback = (type, requestId, done) => submitFeedback(base, {
				recommendation_id: item.id,
				feedback_type: type,
				request_id: requestId
			}).then(() => {
				setStatus(done);
			});
			const toggleSave = (listKind) => {
				const key = item.item_key !== "" ? item.item_key : item.bvid;
				const currently = saved?.[listKind] === true;
				const run = async () => {
					if (currently) await removeSaved(base, listKind, key);
					else await saveItem(base, listKind, {
						source_platform: item.source_platform !== "" ? item.source_platform : "bilibili",
						content_id: item.content_id !== "" ? item.content_id : item.bvid,
						content_url: item.content_url,
						content_type: item.content_type,
						title: item.title,
						author_name: item.up_name,
						cover_url: item.cover_url
					});
					setSaved((prev) => prev === null ? prev : {
						...prev,
						[listKind]: !currently
					});
				};
				return run();
			};
			const submitComment = () => {
				const note = comment.trim();
				if (note === "") return;
				const commentId = stableId();
				setComment("");
				act("comment", () => submitFeedback(base, {
					recommendation_id: item.id,
					feedback_type: "comment",
					note,
					request_id: commentId
				}).then(() => {
					setStatus("评论已记下。");
				}), "评论已记下。", "success");
			};
			const anyBusy = busy !== null;
			const key = item.item_key !== "" ? item.item_key : item.bvid;
			const isText = item.content_type === "tweet" || item.content_type === "thread" || item.body_text !== "";
			const open = () => {
				openItem(base, {
					recommendation_id: item.id,
					content_id: item.content_id,
					bvid: item.bvid,
					content_url: item.content_url,
					source_platform: item.source_platform,
					title: item.title
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.recCard,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: panel_module_css_default.recCover,
						onClick: open,
						"aria-label": item.title,
						children: [!isText && item.cover_url !== "" ? (0, react_jsx_runtime.jsx)("img", {
							src: item.cover_url,
							alt: "",
							loading: "lazy",
							referrerPolicy: "no-referrer"
						}) : (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.recCoverText,
							children: isText && item.body_text !== "" ? item.body_text : item.title
						}), (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.coverCorner,
							children: platformLabel(item.source_platform)
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.recBody,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.badgeRow,
								children: [item.topic_label !== "" ? (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.topicBadge,
									children: item.topic_label
								}) : null, (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.stateBadge,
									children: item.presented ? "你应该刷到过" : "刚给你翻出来"
								})]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.recTitle,
								children: item.title !== "" ? item.title : item.body_text !== "" ? item.body_text.slice(0, 80) : item.bvid
							}),
							item.expression !== "" ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.expression,
								children: item.expression
							}) : null,
							(0, react_jsx_runtime.jsx)(MetaRow, {
								platform: item.source_platform,
								author: item.up_name,
								time: item.published_label
							}),
							(0, react_jsx_runtime.jsx)(StatsRow, { item }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.cardActions,
								children: [
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "去看看",
										primary: true,
										disabled: anyBusy,
										onClick: open
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "多来点",
										disabled: anyBusy,
										onClick: () => void act("like", () => feedback("like", likeId, "记下了，这类可以多来点。"), "记下了，这类可以多来点。", "success")
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `${panel_module_css_default.savedToggle} ${panel_module_css_default.watchToggle}`,
										"data-pressed": saved?.watch_later === true,
										"aria-pressed": saved?.watch_later === true,
										title: "稍后再看",
										disabled: anyBusy || saved === null,
										onClick: () => void act("watch_later", () => toggleSave("watch_later")),
										children: (0, react_jsx_runtime.jsx)(ClockIcon, { size: 14 })
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `${panel_module_css_default.savedToggle} ${panel_module_css_default.starToggle}`,
										"data-pressed": saved?.favorite === true,
										"aria-pressed": saved?.favorite === true,
										title: "收藏",
										disabled: anyBusy || saved === null,
										onClick: () => void act("favorite", () => toggleSave("favorite")),
										children: (0, react_jsx_runtime.jsx)(StarIcon, { size: 14 })
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "少来点",
										danger: true,
										disabled: anyBusy,
										onClick: () => void act("dislike", () => feedback("dislike", dislikeId, "记下了，这路子先少来点。"), "记下了，这路子先少来点。", "success")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "移除",
										disabled: anyBusy,
										onClick: () => void act("dismiss", () => feedback("dismiss", dismissId, "已移除。").then(() => {
											onDismissed(item.id);
										}), "已移除。", "success")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: composerOpen ? "收起" : "说说原因",
										disabled: anyBusy,
										onClick: () => setComposerOpen((open) => !open)
									})
								]
							}),
							composerOpen ? (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.commentComposer,
								children: [(0, react_jsx_runtime.jsx)("textarea", {
									rows: 3,
									placeholder: "写一句你为什么想看，或者为什么不想看",
									value: comment,
									disabled: anyBusy,
									onChange: (event) => setComment(event.target.value)
								}), (0, react_jsx_runtime.jsx)(ActionButton, {
									label: "发送",
									primary: true,
									disabled: anyBusy || comment.trim() === "",
									onClick: submitComment
								})]
							}) : null,
							status !== "" ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.feedbackStatus,
								"data-tone": statusTone,
								children: status
							}) : null
						]
					}),
					(0, react_jsx_runtime.jsx)("span", {
						style: { display: "none" },
						children: key
					})
				]
			});
		}
		/** Delight banner — popup structure: collapsed row (16:9 thumb + kicker pills
		*  + clamped title + chevron) with a right-edge × column; clicking the row
		*  expands the body (reason + actions + chat composer). */
		function DelightBanner(props) {
			const { base, onError } = props;
			const [queue, setQueue] = (0, react.useState)(null);
			const [index, setIndex] = (0, react.useState)(0);
			const [expanded, setExpanded] = (0, react.useState)(true);
			const [composerOpen, setComposerOpen] = (0, react.useState)(false);
			const [chatDraft, setChatDraft] = (0, react.useState)("");
			const [chatStatus, setChatStatus] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)("");
			const [reaction, setReaction] = (0, react.useState)(null);
			const [saved, setSaved] = (0, react.useState)(null);
			const reload = (0, react.useCallback)(async () => {
				try {
					setQueue(await fetchDelightBatch(base));
					setIndex(0);
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				}
			}, [base, onError]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const item = queue === null ? null : queue[Math.min(index, queue.length - 1)];
			(0, react.useEffect)(() => {
				let cancelled = false;
				if (item === void 0 || item === null) return;
				const key = item.item_key !== "" ? item.item_key : item.bvid;
				if (key === "") return;
				Promise.all([fetchSavedStatus(base, "favorite", key).catch(() => false), fetchSavedStatus(base, "watch_later", key).catch(() => false)]).then(([favorite, watch_later]) => {
					if (!cancelled) setSaved({
						favorite,
						watch_later
					});
				});
				return () => {
					cancelled = true;
				};
			}, [base, item]);
			const respond = (0, react.useCallback)(async (target, response, message = "") => {
				setBusy(response);
				try {
					await respondToDelight(base, {
						bvid: target.bvid,
						response,
						title: target.title,
						message,
						request_id: stableId()
					});
					if (response === "dismiss") {
						setQueue((prev) => (prev ?? []).filter((candidate) => candidate.bvid !== target.bvid));
						setExpanded(false);
					} else if (response === "like") setReaction({
						kind: "like",
						text: "已记下，这类惊喜多来点。"
					});
					else if (response === "dislike") setReaction({
						kind: "dislike",
						text: "记下了，这类惊喜先少来点。"
					});
					else if (response === "view") setReaction({
						kind: "view",
						text: "已看过。"
					});
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [base, onError]);
			const toggleSave = (0, react.useCallback)(async (listKind) => {
				if (item === void 0 || item === null) return;
				const key = item.item_key !== "" ? item.item_key : item.bvid;
				const currently = saved?.[listKind] === true;
				setBusy(listKind);
				try {
					if (currently) await removeSaved(base, listKind, key);
					else await saveItem(base, listKind, {
						source_platform: item.source_platform !== "" ? item.source_platform : "bilibili",
						content_id: item.content_id !== "" ? item.content_id : item.bvid,
						content_url: item.content_url,
						content_type: item.content_type,
						title: item.title,
						cover_url: item.cover_url
					});
					setSaved((prev) => prev === null ? prev : {
						...prev,
						[listKind]: !currently
					});
					setReaction({
						kind: listKind,
						text: currently ? "已从列表移除。" : listKind === "favorite" ? "已收藏。" : "已加入稍后再看。"
					});
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				item,
				onError,
				saved
			]);
			const sendChat = (0, react.useCallback)(async () => {
				if (item === void 0 || item === null) return;
				const message = chatDraft.trim();
				if (message === "") return;
				setChatDraft("");
				setBusy("chat");
				try {
					await respondToDelight(base, {
						bvid: item.bvid,
						response: "chat",
						title: item.title,
						message,
						request_id: stableId()
					});
					setChatStatus("已转达给阿B，它会接着品。");
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				chatDraft,
				item,
				onError
			]);
			if (queue === null) return null;
			if (queue.length === 0) return null;
			if (item === void 0 || item === null) return null;
			const anyBusy = busy !== "";
			const isText = item.body_text !== "";
			const open = () => {
				openItem(base, {
					recommendation_id: void 0,
					content_id: item.content_id !== "" ? item.content_id : item.bvid,
					bvid: item.bvid,
					content_url: item.content_url,
					source_platform: item.source_platform,
					title: item.title
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.delightCard,
				"data-expanded": expanded,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.delightHeader,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.delightKicker,
								children: "✨ 惊喜推荐"
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.delightPlatform,
								children: platformLabel(item.source_platform)
							}),
							(0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.spacer }),
							queue.length > 1 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: panel_module_css_default.delightNav,
									title: "上一条",
									disabled: index <= 0 || anyBusy,
									onClick: () => {
										setIndex((i) => Math.max(0, i - 1));
										setReaction(null);
									},
									children: "‹"
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.delightCounter,
									children: [
										index + 1,
										"/",
										queue.length
									]
								}),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: panel_module_css_default.delightNav,
									title: "下一条",
									disabled: index >= queue.length - 1 || anyBusy,
									onClick: () => {
										setIndex((i) => Math.min(queue.length - 1, i + 1));
										setReaction(null);
									},
									children: "›"
								})
							] }) : null,
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.delightDismiss,
								title: "看过了，不再推荐",
								disabled: anyBusy,
								onClick: () => void respond(item, "dismiss"),
								children: "×"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: panel_module_css_default.delightMain,
						onClick: () => setExpanded((v) => !v),
						"aria-expanded": expanded,
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.delightCover,
							children: [
								item.cover_url !== "" ? (0, react_jsx_runtime.jsx)("img", {
									className: panel_module_css_default.delightHero,
									src: item.cover_url,
									alt: "",
									loading: "lazy",
									referrerPolicy: "no-referrer"
								}) : (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.delightHeroFallback,
									children: isText && item.body_text !== "" ? item.body_text.slice(0, 120) : "✨"
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.delightCoverScrim,
									"aria-hidden": "true"
								}),
								item.cover_url !== "" && item.delight_score > 0 ? (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.delightScorePill,
									children: [
										"💗 ",
										Math.round(item.delight_score * 100),
										"% 匹配"
									]
								}) : null
							]
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.delightTitleWrap,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.delightTitle,
								children: item.title !== "" ? item.title : item.body_text !== "" ? item.body_text.slice(0, 80) : item.bvid
							}), (0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.delightChevron,
								"aria-hidden": "true",
								children: expanded ? "▾" : "▸"
							})]
						})]
					}),
					expanded ? (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.delightBody,
						children: [
							item.delight_reason !== "" ? (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.delightReason,
								children: [
									(0, react_jsx_runtime.jsxs)("span", {
										className: panel_module_css_default.delightScore,
										children: [Math.round(item.delight_score * 100), "%"]
									}),
									" · ",
									item.delight_reason
								]
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.delightActions,
								children: [
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "看看",
										primary: true,
										disabled: anyBusy,
										onClick: open
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: reaction?.kind === "like" ? "已喜欢" : "喜欢",
										primary: reaction?.kind === "like",
										disabled: anyBusy || reaction?.kind === "like",
										onClick: () => void respond(item, "like")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: saved?.watch_later === true ? "已稍后" : "稍后看",
										disabled: anyBusy || saved === null,
										onClick: () => void toggleSave("watch_later")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: saved?.favorite === true ? "已收藏" : "收藏",
										disabled: anyBusy || saved === null,
										onClick: () => void toggleSave("favorite")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "少来点",
										danger: true,
										disabled: anyBusy,
										onClick: () => void respond(item, "dislike")
									}),
									(0, react_jsx_runtime.jsx)(ActionButton, {
										label: composerOpen ? "收起" : "聊一聊",
										disabled: anyBusy,
										onClick: () => setComposerOpen((v) => !v)
									})
								]
							}),
							composerOpen ? (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.delightComposer,
								children: [(0, react_jsx_runtime.jsx)("textarea", {
									className: panel_module_css_default.chatInput,
									rows: 2,
									placeholder: "说说你为什么想点开，或者哪里还拿不准",
									value: chatDraft,
									disabled: anyBusy,
									onChange: (event) => setChatDraft(event.target.value)
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: panel_module_css_default.chatSend,
									disabled: anyBusy || chatDraft.trim() === "",
									onClick: () => void sendChat(),
									children: "发送"
								})]
							}) : null,
							chatStatus !== "" ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.feedbackStatus,
								children: chatStatus
							}) : null,
							reaction !== null ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.feedbackStatus,
								"data-tone": reaction.kind === "dislike" ? "error" : "success",
								children: reaction.text
							}) : null
						]
					}) : null
				]
			});
		}
		/** Activity footer — popup-style: collapsed line (summary + headline) with a
		*  更多/收起 toggle; expanded rows are footer-item cards with a kind pill,
		*  time and summary, plus a dashed load-more button. */
		function ActivityFooter(props) {
			const { base } = props;
			const [feed, setFeed] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [loadingMore, setLoadingMore] = (0, react.useState)(false);
			const reload = (0, react.useCallback)(async () => {
				try {
					setFeed(await fetchActivityFeed(base, { limit: 5 }));
				} catch {
					setFeed(null);
				}
			}, [base]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const loadMore = (0, react.useCallback)(async () => {
				if (feed === null || !feed.hasMore || loadingMore) return;
				setLoadingMore(true);
				try {
					const next = await fetchActivityFeed(base, {
						limit: 5,
						before: feed.nextCursor
					});
					setFeed((prev) => prev === null ? next : {
						...next,
						items: [...prev.items, ...next.items]
					});
				} finally {
					setLoadingMore(false);
				}
			}, [
				base,
				feed,
				loadingMore
			]);
			if (feed === null || feed.items.length === 0 && feed.liveSummary === "" && feed.headline === "") return null;
			const summaryOf = (item) => {
				if (typeof item.summary === "string" && item.summary !== "") return item.summary;
				const kind = typeof item.kind === "string" ? item.kind : "";
				return kind !== "" ? kind.replace(/[._]/g, " ") : JSON.stringify(item).slice(0, 120);
			};
			const kindOf = (item) => typeof item.kind === "string" && item.kind !== "" ? item.kind : "动态";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.activityFooter,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.footerHead,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.footerCopy,
						children: [(0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.footerHint,
							children: feed.liveSummary !== "" ? feed.liveSummary : "阿B 这会儿先替你盯着。"
						}), (0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.footerHeadline,
							children: feed.headline !== "" ? feed.headline : "最近还没新动静，先多刷一阵。"
						})]
					}), feed.items.length > 0 ? (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.footerToggle,
						"aria-expanded": expanded,
						onClick: () => setExpanded((v) => !v),
						children: expanded ? "收起" : "更多"
					}) : null]
				}), expanded && feed.items.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.footerHistory,
					children: [feed.items.map((item, i) => (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.footerItem,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.footerItemMeta,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.footerItemKind,
								children: kindOf(item)
							}), (0, react_jsx_runtime.jsx)("span", { children: typeof item.occurred_at === "string" && item.occurred_at !== "" ? formatTime(item.occurred_at) : "" })]
						}), (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.footerItemSummary,
							children: summaryOf(item)
						})]
					}, String(item.id ?? i))), feed.hasMore ? (0, react_jsx_runtime.jsx)(ActionButton, {
						label: "加载更多",
						disabled: loadingMore,
						onClick: () => void loadMore()
					}) : null]
				}) : null]
			});
		}
		/** 推荐 tab: header + pool status + delight + recommendation cards + activity. */
		function RecommendView(props) {
			const { base, refreshKey } = props;
			const [items, setItems] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)("");
			const [excluded, setExcluded] = (0, react.useState)([]);
			const reload = (0, react.useCallback)(async () => {
				try {
					const [recs, runtime] = await Promise.all([fetchRecommendations(base), fetchRuntimeStatus(base)]);
					setItems(recs);
					setStatus(runtime);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [base]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const run = (0, react.useCallback)(async (label, action) => {
				setBusy(label);
				setError("");
				try {
					setItems(await action());
					setExcluded([]);
					await fetchRuntimeStatus(base).then(setStatus).catch(() => void 0);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [base]);
			const visibleIds = items?.map((item) => item.item_key !== "" ? item.item_key : item.bvid).filter(Boolean) ?? [];
			const excludeAll = [...excluded, ...visibleIds];
			const [exhausted, setExhausted] = (0, react.useState)(false);
			const sentinelRef = (0, react.useRef)(null);
			const appendMore = (0, react.useCallback)(async () => {
				if (items === null || busy !== "" || exhausted) return;
				setBusy("append-auto");
				try {
					const next = await appendRecommendations(base, { excludedBvids: [...excluded, ...items.map((item) => item.item_key !== "" ? item.item_key : item.bvid).filter(Boolean)] });
					if (next.length === 0) setExhausted(true);
					else {
						setItems((prev) => [...prev ?? [], ...next]);
						setExcluded((prev) => [...prev, ...items.map((item) => item.item_key !== "" ? item.item_key : item.bvid).filter(Boolean)]);
					}
					await fetchRuntimeStatus(base).then(setStatus).catch(() => void 0);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				busy,
				exhausted,
				items,
				excluded
			]);
			(0, react.useEffect)(() => {
				const el = sentinelRef.current;
				if (el === null) return;
				const root = el.parentElement;
				const observer = new IntersectionObserver((entries) => {
					for (const entry of entries) if (entry.isIntersecting) appendMore();
				}, {
					root,
					rootMargin: "800px 0px 800px 0px"
				});
				observer.observe(el);
				return () => {
					observer.disconnect();
				};
			}, [appendMore]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.recHeader,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.recHeaderCopy,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.recKicker,
								children: "For You"
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.recHeaderTitle,
								children: "这几条，你大概会点开"
							}),
							status !== null ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.poolChips,
								children: poolStatus(status).map((chip) => (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.poolChip,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.poolChipLabel,
										children: chip.label
									}), (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.poolChipValue,
										children: chip.value
									})]
								}, chip.label))
							}) : null
						]
					}), (0, react_jsx_runtime.jsx)(ActionButton, {
						label: "换一批",
						disabled: busy !== "",
						onClick: () => {
							setExhausted(false);
							run("reshuffle", () => reshuffleRecommendations(base, { excludedBvids: excludeAll }));
						}
					})]
				}),
				error !== "" ? (0, react_jsx_runtime.jsx)(ErrorNote, { text: error }) : null,
				(0, react_jsx_runtime.jsx)(DelightBanner, {
					base,
					onError: setError
				}, `delight-${refreshKey}`),
				items !== null && items.length === 0 ? (0, react_jsx_runtime.jsx)(EmptyState, { text: "还没刷出新东西。让 OpenBiliClaw 先积累一些兴趣信号，或等下一轮刷新。" }) : null,
				items?.map((item) => (0, react_jsx_runtime.jsx)(RecommendationCard, {
					base,
					item,
					onDismissed: (id) => setItems((prev) => (prev ?? []).filter((card) => card.id !== id)),
					onError: setError
				}, item.id)),
				items !== null && items.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.cardActions,
					children: [(0, react_jsx_runtime.jsx)(ActionButton, {
						label: "追加一批",
						disabled: busy !== "" || exhausted,
						onClick: () => void run("append", () => appendRecommendations(base, { excludedBvids: excludeAll }).then((next) => {
							if (next.length === 0) setExhausted(true);
							return next;
						}))
					}), (0, react_jsx_runtime.jsx)(ActionButton, {
						label: "刷新",
						disabled: busy !== "",
						onClick: () => {
							setExhausted(false);
							reload();
						}
					})]
				}) : null,
				exhausted ? (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.hint,
					style: { textAlign: "center" },
					children: "这池先翻到头了，后台还在继续补货。"
				}) : null,
				busy === "append-auto" || busy === "append" ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.loadingRow,
					role: "status",
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.spinner,
						"aria-hidden": "true"
					}), "正在加载下一批…"]
				}) : null,
				(0, react_jsx_runtime.jsx)("div", {
					ref: sentinelRef,
					style: { height: 2 },
					"aria-hidden": "true"
				})
			] });
		}
		//#endregion
		//#region lib/types/client/library.js
		/**
		* 内容库 view — mirroring the canonical library surface: 稍后再看 / 收藏 /
		* 历史记录 (30-day clicked/shown/removed with cursor pagination and removal
		* context badges).
		* @module @openbiliclaw/dsh-plugin
		*/
		const LIBRARY_TABS = [
			{
				key: "watch_later",
				label: "稍后再看"
			},
			{
				key: "favorite",
				label: "收藏"
			},
			{
				key: "history",
				label: "历史记录"
			}
		];
		const HISTORY_CATEGORIES = [
			{
				key: "clicked",
				label: "点开过"
			},
			{
				key: "shown",
				label: "看过"
			},
			{
				key: "removed",
				label: "移除的"
			}
		];
		/** Saved list sub-view (稍后再看 / 收藏). */
		function SavedList(props) {
			const { base, listKind } = props;
			const [items, setItems] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [removing, setRemoving] = (0, react.useState)("");
			const reload = (0, react.useCallback)(async () => {
				try {
					setItems(await fetchSaved(base, listKind));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [base, listKind]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const remove = (0, react.useCallback)(async (itemKey) => {
				setRemoving(itemKey);
				setError("");
				try {
					await removeSaved(base, listKind, itemKey);
					await reload();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setRemoving("");
				}
			}, [
				base,
				listKind,
				reload
			]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				error !== "" ? (0, react_jsx_runtime.jsx)(ErrorNote, { text: error }) : null,
				items !== null && items.length === 0 ? (0, react_jsx_runtime.jsx)(EmptyState, { text: listKind === "favorite" ? "还没有收藏。看到喜欢的卡片点「收藏」即可。" : "还没有稍后再看。" }) : null,
				items?.map((item) => (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.card,
					children: [(0, react_jsx_runtime.jsx)(Thumb, {
						url: item.cover_url,
						title: item.title,
						kind: "video",
						platform: item.source_platform
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.cardBody,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.cardTitle,
								children: item.title !== "" ? item.title : item.item_key
							}),
							(0, react_jsx_runtime.jsx)(MetaRow, {
								platform: item.source_platform,
								author: item.author_name
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.cardActions,
								children: [(0, react_jsx_runtime.jsx)(ActionButton, {
									label: "打开",
									primary: true,
									disabled: removing !== "",
									onClick: () => {
										const url = item.content_url !== "" ? item.content_url : item.source_platform === "bilibili" && item.content_id !== "" ? `https://www.bilibili.com/video/${item.content_id}` : "";
										if (url !== "") window.open(url, "_blank", "noopener");
									}
								}), (0, react_jsx_runtime.jsx)(ActionButton, {
									label: "移除",
									danger: true,
									disabled: removing !== "",
									onClick: () => void remove(item.item_key)
								})]
							})
						]
					})]
				}, item.item_key))
			] });
		}
		/** Context badges for one history item (收藏/稍后/不再推荐/不喜欢 + 恢复). */
		function HistoryContextBadges(props) {
			const { item } = props;
			const badges = [];
			if (item.contexts.length > 0) for (const ctx of item.contexts) {
				const label = ctx.context === "favorite" ? "收藏" : ctx.context === "watch_later" ? "稍后再看" : ctx.context === "dismiss" ? "不再推荐" : ctx.context === "dislike" ? "不喜欢" : ctx.context;
				badges.push({
					key: `${ctx.context}:${ctx.occurred_at}`,
					label: ctx.restored ? `${label}·已恢复` : label,
					kind: ctx.restored ? "restored" : ctx.context === "dismiss" || ctx.context === "dislike" ? "removed" : void 0
				});
			}
			if (badges.length === 0 && item.context !== "") {
				const label = item.context === "favorite" ? "收藏" : item.context === "watch_later" ? "稍后再看" : item.context === "dismiss" ? "不再推荐" : item.context === "dislike" ? "不喜欢" : item.context;
				badges.push({
					key: item.context,
					label: item.restored ? `${label}·已恢复` : label,
					kind: item.restored ? "restored" : void 0
				});
			}
			if (badges.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.badgeRow,
				children: badges.map((badge) => (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.contextBadge,
					"data-kind": badge.kind,
					children: badge.label
				}, badge.key))
			});
		}
		/** History sub-view: 30-day clicked/shown/removed with cursor pagination. */
		function HistoryList(props) {
			const { base } = props;
			const [category, setCategory] = (0, react.useState)("clicked");
			const [items, setItems] = (0, react.useState)(null);
			const [total, setTotal] = (0, react.useState)(0);
			const [cursor, setCursor] = (0, react.useState)("");
			const [hasMore, setHasMore] = (0, react.useState)(false);
			const [loadingMore, setLoadingMore] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const load = (0, react.useCallback)(async (cat, pageCursor, append) => {
				setError("");
				try {
					const page = await fetchContentHistory(base, cat, pageCursor);
					setItems((prev) => append && prev !== null ? [...prev, ...page.items] : page.items);
					setTotal(page.total);
					setCursor(page.nextCursor);
					setHasMore(page.hasMore);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [base]);
			(0, react.useEffect)(() => {
				load(category, "", false);
			}, [category, load]);
			const loadMore = (0, react.useCallback)(async () => {
				if (!hasMore || loadingMore) return;
				setLoadingMore(true);
				try {
					await load(category, cursor, true);
				} finally {
					setLoadingMore(false);
				}
			}, [
				category,
				cursor,
				hasMore,
				load,
				loadingMore
			]);
			const sentinelRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const el = sentinelRef.current;
				if (el === null) return;
				const root = el.parentElement;
				const observer = new IntersectionObserver((entries) => {
					for (const entry of entries) if (entry.isIntersecting) loadMore();
				}, {
					root,
					rootMargin: "800px 0px 800px 0px"
				});
				observer.observe(el);
				return () => {
					observer.disconnect();
				};
			}, [loadMore]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.subTabs,
					children: HISTORY_CATEGORIES.map((item) => (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.subTab,
						"data-active": category === item.key,
						onClick: () => setCategory(item.key),
						children: item.label
					}, item.key))
				}),
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.hint,
					children: [
						"近 30 天 · 共 ",
						total,
						" 条"
					]
				}),
				error !== "" ? (0, react_jsx_runtime.jsx)(ErrorNote, { text: error }) : null,
				items !== null && items.length === 0 ? (0, react_jsx_runtime.jsx)(EmptyState, { text: "这个分类还没有记录。" }) : null,
				items?.map((item) => (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.card,
					children: [(0, react_jsx_runtime.jsx)(Thumb, {
						url: item.cover_url,
						title: item.title,
						kind: item.body_text !== "" ? "text" : "video",
						platform: item.source_platform
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.cardBody,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.cardTitle,
								children: item.title !== "" ? item.title : item.body_text !== "" ? item.body_text.slice(0, 60) : item.item_key
							}),
							(0, react_jsx_runtime.jsx)(MetaRow, {
								platform: item.source_platform,
								author: item.author_name,
								time: item.occurred_at
							}),
							(0, react_jsx_runtime.jsx)(HistoryContextBadges, { item }),
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.cardActions,
								children: (0, react_jsx_runtime.jsx)(ActionButton, {
									label: "打开",
									primary: true,
									onClick: () => {
										if (item.content_url !== "") window.open(item.content_url, "_blank", "noopener");
									}
								})
							})
						]
					})]
				}, item.item_key)),
				hasMore ? (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: panel_module_css_default.loadMore,
					disabled: loadingMore,
					onClick: () => void loadMore(),
					children: "加载更多"
				}) : null,
				loadingMore ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.loadingRow,
					role: "status",
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.spinner,
						"aria-hidden": "true"
					}), "正在加载更多历史…"]
				}) : null,
				(0, react_jsx_runtime.jsx)("div", {
					ref: sentinelRef,
					style: { height: 2 },
					"aria-hidden": "true"
				})
			] });
		}
		/** 内容库 tab: 稍后再看 / 收藏 / 历史记录. */
		function LibraryView(props) {
			const { base } = props;
			const [tab, setTab] = (0, react.useState)("watch_later");
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.subTabs,
					children: LIBRARY_TABS.map((item) => (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.subTab,
						"data-active": tab === item.key,
						onClick: () => setTab(item.key),
						children: item.label
					}, item.key))
				}),
				tab === "watch_later" ? (0, react_jsx_runtime.jsx)(SavedList, {
					base,
					listKind: "watch_later"
				}, `wl-${base}`) : null,
				tab === "favorite" ? (0, react_jsx_runtime.jsx)(SavedList, {
					base,
					listKind: "favorite"
				}, `fav-${base}`) : null,
				tab === "history" ? (0, react_jsx_runtime.jsx)(HistoryList, { base }, `hist-${base}`) : null
			] });
		}
		//#endregion
		//#region lib/types/client/dialogue.js
		/**
		* 对话 view — mirrors the canonical dialogue surface: pending confirmations
		* (待聊确认), hypothesis cards with optimistic four-state actions
		* (准/不准/聊聊/稍后) and state labels, the 聊聊 → dialogue-context flow
		* (subsequent messages reply to the card), and durable chat turns.
		* @module @openbiliclaw/dsh-plugin
		*/
		const CHAT_SESSION = "dsh";
		const CONTEXT_KEY = "openbiliclaw.dialogue-context";
		function readContext() {
			try {
				const raw = localStorage.getItem(CONTEXT_KEY);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (typeof parsed.turnId === "string" && parsed.turnId !== "") return {
					turnId: parsed.turnId,
					title: typeof parsed.title === "string" ? parsed.title : "",
					kind: parsed.kind === "confusion" ? "confusion" : "hypothesis",
					...typeof parsed.observation === "string" ? { observation: parsed.observation } : {},
					...typeof parsed.interpretation === "string" ? { interpretation: parsed.interpretation } : {}
				};
				return null;
			} catch {
				return null;
			}
		}
		function writeContext(sel) {
			try {
				if (sel === null) localStorage.removeItem(CONTEXT_KEY);
				else localStorage.setItem(CONTEXT_KEY, JSON.stringify(sel));
			} catch {}
		}
		/** Terminal card states hide the action set (same as the shared helper). */
		const TERMINAL_CARD_STATES = new Set([
			"confirmed",
			"rejected",
			"revised",
			"deferred"
		]);
		/** Canonical state labels (mobile/popup shared helper). */
		const CARD_STATE_LABELS = {
			confirmed: "已确认",
			rejected: "已标记不准",
			revised: "已按你的修正记下",
			discussing: "正在聊这条",
			deferred: "已稍后再聊",
			processing: "正在处理，以后端结算为准",
			retryable_error: "处理结果暂未同步，可刷新或重试"
		};
		/** Canonical action labels (popup uses short pills). */
		const CARD_ACTIONS = [
			{
				action: "confirm",
				label: "准"
			},
			{
				action: "reject",
				label: "不准"
			},
			{
				action: "discuss",
				label: "聊聊"
			},
			{
				action: "defer",
				label: "稍后"
			}
		];
		/** Optimistic next state per action (shared helper's applyOptimisticCardAction). */
		const OPTIMISTIC_STATE = {
			confirm: "confirmed",
			reject: "rejected",
			discuss: "discussing",
			defer: "deferred"
		};
		/** Read the durable card state (defaults to pending). */
		function cardState(turn) {
			const state = typeof turn.payload?.state === "string" ? turn.payload.state : "";
			return state !== "" ? state : "pending";
		}
		/** Poll one pending turn until it settles. */
		async function waitForTurn(base, turnId, signal) {
			for (let attempt = 0; attempt < 60; attempt += 1) {
				if (signal?.aborted === true) throw new Error("已取消");
				const turn = await fetchChatTurn(base, turnId, signal);
				if (turn.status !== "pending") return turn;
				await new Promise((resolve) => window.setTimeout(resolve, 2e3));
			}
			throw new Error("对话回合等待超时");
		}
		/** One pending confirmation row (待聊确认 panel, canonical pending-item). */
		function ConfirmationItem(props) {
			const { base, item, onOpened, onError } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const open = (0, react.useCallback)(async () => {
				setBusy(true);
				try {
					onOpened(await openPendingConfirmation(base, item.ref));
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			}, [
				base,
				item.ref,
				onError,
				onOpened
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.pendingItem,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.pendingCopy,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.pendingKind,
							children: item.kind === "confusion" ? "有点疑惑" : "想确认"
						}),
						(0, react_jsx_runtime.jsx)("strong", { children: item.title !== "" ? item.title : item.ref }),
						item.observation !== "" ? (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.pendingObservation,
							children: item.observation
						}) : null,
						item.interpretation !== "" ? (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.pendingInterpretation,
							children: item.interpretation
						}) : null,
						item.confidence > 0 ? (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.pendingConfidence,
							children: [Math.round(item.confidence * 100), "%"]
						}) : null
					]
				}), (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: panel_module_css_default.pendingOpen,
					disabled: busy,
					onClick: () => void open(),
					children: busy ? "打开中…" : "打开"
				})]
			});
		}
		/** One hypothesis card turn with optimistic four-state actions. */
		function CardTurnBlock(props) {
			const { base, turn, onDiscuss, onChanged, onError } = props;
			const [state, setState] = (0, react.useState)(() => cardState(turn));
			const [busy, setBusy] = (0, react.useState)("");
			const payload = turn.payload ?? {};
			const title = typeof payload.title === "string" && payload.title !== "" ? payload.title : turn.subject_title !== "" ? turn.subject_title : "这条猜测";
			const evidence = Array.isArray(payload.evidence_refs) ? payload.evidence_refs.map(String).filter(Boolean) : [];
			const terminal = TERMINAL_CARD_STATES.has(state);
			const act = (0, react.useCallback)(async (action) => {
				setBusy(action);
				setState(OPTIMISTIC_STATE[action] ?? cardState(turn));
				try {
					const response = await actOnChatCard(base, turn.turn_id, action);
					const verdict = typeof response === "object" && response !== null ? String(response.state ?? response.verdict ?? "").toLowerCase() : "";
					if (verdict !== "") setState(verdict);
					if (action === "discuss") onDiscuss(turn);
					onChanged();
				} catch (err) {
					setState(cardState(turn));
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				onChanged,
				onDiscuss,
				onError,
				turn
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.dialogueCard,
				"data-card-state": state,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.dialogueKicker,
						children: "阿B 的猜测"
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.dialogueTitle,
						children: title
					}),
					evidence.length > 0 ? (0, react_jsx_runtime.jsxs)("details", {
						className: panel_module_css_default.dialogueEvidence,
						children: [(0, react_jsx_runtime.jsxs)("summary", { children: [
							"依据（",
							evidence.length,
							"）"
						] }), (0, react_jsx_runtime.jsx)("ul", { children: evidence.slice(0, 5).map((line, i) => (0, react_jsx_runtime.jsx)("li", { children: line }, i)) })]
					}) : null,
					CARD_STATE_LABELS[state] !== void 0 && CARD_STATE_LABELS[state] !== "" ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.dialogueState,
						role: "status",
						children: CARD_STATE_LABELS[state]
					}) : null,
					!terminal ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.dialogueActions,
						"aria-label": "确认这条猜测",
						children: CARD_ACTIONS.map((entry) => (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: `${panel_module_css_default.dialogueAction} ${panel_module_css_default[`action_${entry.action}`] ?? ""}`,
							disabled: busy !== "" || state === "discussing" && entry.action === "discuss",
							onClick: () => void act(entry.action),
							children: entry.label
						}, entry.action))
					}) : null
				]
			});
		}
		/** 对话 tab. */
		function ChatView(props) {
			const { base } = props;
			const [turns, setTurns] = (0, react.useState)(null);
			const [confirmations, setConfirmations] = (0, react.useState)(null);
			const [confirmOpen, setConfirmOpen] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [draft, setDraft] = (0, react.useState)("");
			const [sending, setSending] = (0, react.useState)(false);
			const [context, setContextState] = (0, react.useState)(() => readContext());
			const setContext = (0, react.useCallback)((sel) => {
				writeContext(sel);
				setContextState(sel);
			}, []);
			const scrollRef = (0, react.useRef)(null);
			const reload = (0, react.useCallback)(async () => {
				try {
					const [history, pending] = await Promise.all([fetchChatTurns(base, CHAT_SESSION), fetchPendingConfirmations(base)]);
					setTurns(history);
					setConfirmations(pending);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [base]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			(0, react.useEffect)(() => {
				const el = scrollRef.current;
				if (el !== null) el.scrollTop = el.scrollHeight;
			}, [turns, sending]);
			/** Start one durable turn (optionally bound to the discussion context). */
			const send = (0, react.useCallback)(async () => {
				const message = draft.trim();
				if (message === "" || sending) return;
				setSending(true);
				setError("");
				const optimistic = {
					turn_id: `pending-${Date.now()}`,
					session: CHAT_SESSION,
					scope: "chat",
					message,
					reply: "",
					status: "pending",
					error: "",
					subject_title: "",
					reply_to_turn_id: context?.turnId
				};
				setTurns((prev) => [...prev ?? [], optimistic]);
				setDraft("");
				try {
					const started = await startChatTurn(base, message, CHAT_SESSION, context?.turnId);
					setTurns((prev) => [...(prev ?? []).filter((t) => t.turn_id !== optimistic.turn_id), started]);
					const settled = await waitForTurn(base, started.turn_id);
					setTurns((prev) => (prev ?? []).map((t) => t.turn_id === started.turn_id ? settled : t));
					await reload();
				} catch (err) {
					setTurns((prev) => (prev ?? []).filter((t) => t.turn_id !== optimistic.turn_id));
					setError(err instanceof ApiError && err.status === 409 ? "这条上下文已经失效（卡片可能已结算，或另开了一条讨论）。点「清除」后重发，或回到卡片重新点「聊聊」。" : err instanceof Error ? err.message : String(err));
					await reload().catch(() => void 0);
				} finally {
					setSending(false);
				}
			}, [
				base,
				context,
				draft,
				reload,
				sending
			]);
			const onKeyDown = (0, react.useCallback)((event) => {
				if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
					event.preventDefault();
					send();
				}
			}, [send]);
			const visibleTurns = turns?.filter((t) => t.message !== "" || t.reply !== "" || t.payload !== void 0 && Object.keys(t.payload).length > 0) ?? null;
			const cardTurns = visibleTurns?.filter((t) => t.payload !== void 0 && t.payload.type === "card") ?? [];
			const activeCardTurns = cardTurns.filter((t) => !TERMINAL_CARD_STATES.has(cardState(t)));
			const handledCardCount = cardTurns.length - activeCardTurns.length;
			const questionTurns = visibleTurns?.filter((t) => t.payload !== void 0 && t.payload.type === "question") ?? [];
			const plainTurns = visibleTurns?.filter((t) => !cardTurns.includes(t) && !questionTurns.includes(t)) ?? [];
			/** Resolve the card a bound reply belongs to (canonical reply-quote). */
			const targetOf = (turn) => {
				const replyTo = turn.reply_to_turn_id ?? "";
				if (replyTo === "") return null;
				const target = cardTurns.find((c) => c.turn_id === replyTo);
				if (target === void 0) return null;
				return { title: typeof target.payload?.title === "string" && target.payload.title !== "" ? target.payload.title : target.subject_title };
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.toolbar,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.hint,
							children: "苏格拉底式对话 · 自动反馈进画像"
						}),
						(0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.spacer }),
						(0, react_jsx_runtime.jsx)(ActionButton, {
							label: "刷新",
							disabled: sending,
							onClick: () => void reload()
						})
					]
				}),
				error !== "" ? (0, react_jsx_runtime.jsx)(ErrorNote, { text: error }) : null,
				confirmations !== null && confirmations.items.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.confirmPanel,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: panel_module_css_default.confirmToggle,
						onClick: () => setConfirmOpen((open) => !open),
						children: ["待聊确认", (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.confirmCount,
							children: confirmations.items.length
						})]
					}), confirmOpen ? confirmations.items.map((item) => (0, react_jsx_runtime.jsx)(ConfirmationItem, {
						base,
						item,
						onOpened: (turn) => {
							if (turn.payload?.type === "question") setContext({
								turnId: turn.turn_id,
								title: turn.subject_title !== "" ? turn.subject_title : "这条疑惑",
								kind: "confusion",
								observation: item.observation,
								interpretation: item.interpretation
							});
							reload();
						},
						onError: setError
					}, item.ref)) : null]
				}) : null,
				(0, react_jsx_runtime.jsxs)("div", {
					ref: scrollRef,
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10,
						overflowY: "auto",
						minHeight: 0,
						flex: 1
					},
					children: [
						plainTurns !== null && plainTurns.length === 0 && activeCardTurns.length === 0 ? (0, react_jsx_runtime.jsx)(EmptyState, { text: "还没有对话。聊聊你最近在看什么、对什么好奇，OpenBiliClaw 会边聊边更新你的画像。" }) : null,
						handledCardCount > 0 ? (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.hint,
							style: { textAlign: "center" },
							children: [
								"已处理 ",
								handledCardCount,
								" 张确认卡"
							]
						}) : null,
						questionTurns.map((turn) => {
							const ctx = context !== null && context.turnId === turn.turn_id ? context : null;
							return (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.questionCard,
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.dialogueKicker,
										children: "有点疑惑"
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.dialogueTitle,
										children: turn.subject_title !== "" ? turn.subject_title : "这条疑惑"
									}),
									ctx !== null && ctx.observation !== void 0 && ctx.observation !== "" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.questionObservation,
										children: ctx.observation
									}) : null,
									ctx !== null && ctx.interpretation !== void 0 && ctx.interpretation !== "" ? (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.questionInterpretation,
										children: ["它自己的理解：", ctx.interpretation]
									}) : null,
									turn.reply !== "" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnSoul,
										style: { maxWidth: "100%" },
										children: turn.reply
									}) : null,
									turn.status === "pending" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnStatus,
										children: "思考中…"
									}) : null
								]
							}, turn.turn_id);
						}),
						activeCardTurns.map((turn) => (0, react_jsx_runtime.jsx)(CardTurnBlock, {
							base,
							turn,
							onDiscuss: (target) => setContext({
								turnId: target.turn_id,
								title: typeof target.payload?.title === "string" ? target.payload.title : target.subject_title,
								kind: "hypothesis"
							}),
							onChanged: () => void reload(),
							onError: setError
						}, turn.turn_id)),
						plainTurns.map((turn) => {
							const quote = targetOf(turn);
							return (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.turn,
								children: [
									quote !== null ? (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.replyQuote,
										children: [(0, react_jsx_runtime.jsx)("span", { children: "回复 阿B 的猜测" }), (0, react_jsx_runtime.jsx)("strong", {
											title: quote.title,
											children: quote.title
										})]
									}) : null,
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnUser,
										children: turn.message
									}),
									turn.reply !== "" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnSoul,
										children: turn.reply
									}) : null,
									turn.status === "pending" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnStatus,
										children: "思考中…"
									}) : null,
									turn.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.turnStatus,
										children: ["出错：", turn.error !== "" ? turn.error : "未知"]
									}) : null,
									turn.updated_at !== void 0 && turn.updated_at !== "" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.turnStatus,
										children: formatTime(turn.updated_at)
									}) : null
								]
							}, turn.turn_id);
						})
					]
				}),
				context !== null ? (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.contextBar,
					role: "status",
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.contextBarHead,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.contextLabel,
								children: context.kind === "confusion" ? "正在回复 有点疑惑" : "正在回复 阿B 的猜测"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.contextClear,
								onClick: () => setContext(null),
								children: "清除"
							})]
						}),
						(0, react_jsx_runtime.jsx)("strong", {
							className: panel_module_css_default.contextTitle,
							title: context.title,
							children: context.title
						}),
						context.kind === "confusion" && context.observation !== void 0 && context.observation !== "" ? (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.contextObservation,
							children: context.observation
						}) : null,
						context.kind === "confusion" && context.interpretation !== void 0 && context.interpretation !== "" ? (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.contextInterpretation,
							children: ["它自己的理解：", context.interpretation]
						}) : null
					]
				}) : null,
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.chatInputRow,
					children: [(0, react_jsx_runtime.jsx)("textarea", {
						className: panel_module_css_default.chatInput,
						rows: 2,
						placeholder: "聊聊你最近对什么感兴趣…",
						value: draft,
						disabled: sending,
						onChange: (event) => setDraft(event.target.value),
						onKeyDown
					}), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.chatSend,
						disabled: sending || draft.trim() === "",
						onClick: () => void send(),
						children: "发送"
					})]
				})
			] });
		}
		//#endregion
		//#region lib/types/client/profile.js
		/**
		* 画像 view — the popup's profile-card structure: view intro, portrait
		* summary, layer headers (Core/Values/Interest/Role/Surface), group cards
		* with chips / MBTI bars / interest trees / style bars, speculative probes,
		* insight cards with confidence bars, and the awareness list.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Split the portrait prose into breathing paragraphs (~2 sentences each). */
		function portraitParagraphs(text) {
			const sentences = text.replace(/([。!?！？])\s*/g, "$1").split("").map((s) => s.trim()).filter(Boolean);
			const paragraphs = [];
			let bucket = "";
			for (const sentence of sentences) {
				bucket += sentence;
				if (bucket.length >= 60) {
					paragraphs.push(bucket);
					bucket = "";
				}
			}
			if (bucket !== "") paragraphs.push(bucket);
			return paragraphs.length > 0 ? paragraphs : [text];
		}
		/** Chips row (tone: brand/success/danger/default). */
		function Chips(props) {
			if (props.chips.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.chipRow,
				children: props.chips.map((chip) => (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.chip,
					"data-tone": props.tone,
					children: chip
				}, chip))
			});
		}
		/** One profile group card (popup .profile-group). */
		function Group(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.profileGroup,
				children: [props.title !== void 0 ? (0, react_jsx_runtime.jsx)("h3", { children: props.title }) : null, props.children]
			});
		}
		/** Uppercase layer divider (popup .profile-layer-header). */
		function Layer(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.profileLayer,
				children: props.label
			});
		}
		/** MBTI display: big type label + confidence pill + dimension bars. */
		function MbtiBlock(props) {
			const { mbti } = props;
			if (mbti.type === "") return null;
			const dimensions = mbti.dimensions !== void 0 ? Object.entries(mbti.dimensions) : [];
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.mbtiContainer,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.mbtiTypeRow,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.mbtiTypeLabel,
						children: mbti.type
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: panel_module_css_default.mbtiConfidence,
						children: [
							"置信 ",
							Math.round(mbti.confidence * 100),
							"%"
						]
					})]
				}), dimensions.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.mbtiDimensions,
					children: dimensions.map(([dim, val]) => (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.mbtiDimRow,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.mbtiDimPole,
								children: val.pole.slice(0, 1)
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.mbtiDimBar,
								children: (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.mbtiDimBarFill,
									style: { width: `${Math.round(val.strength * 100)}%` }
								})
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_default.mbtiDimPct,
								children: [Math.round(val.strength * 100), "%"]
							})
						]
					}, dim))
				}) : null]
			});
		}
		/** Interest tree: 喜欢/不喜欢 labelled domain lists with weighted specifics. */
		function InterestTree(props) {
			if (props.domains.length === 0) return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.interestTree,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.interestTreeLabel,
					"data-tone": props.tone,
					children: props.label
				}), props.domains.map((domain) => (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.interestDomain,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.interestDomainHeader,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.interestDomainName,
							children: domain.domain
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.interestDomainWeight,
							children: [Math.round(domain.weight * 100), "%"]
						})]
					}), domain.specifics.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.chipRow,
						children: domain.specifics.map((spec) => (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.chip,
							"data-tone": props.tone === "danger" ? "danger" : void 0,
							children: [
								spec.name,
								" ",
								(0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.chipWeight,
									children: [Math.round(spec.weight * 100), "%"]
								})
							]
						}, spec.name))
					}) : null]
				}, domain.domain))]
			});
		}
		/** One percentage bar row (style bars / exploration). */
		function BarRow(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.barRow,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.barLabel,
						children: props.label
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.barTrack,
						children: (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.barFill,
							style: { width: `${Math.min(100, Math.max(0, props.pct))}%` }
						})
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: panel_module_css_default.barPct,
						children: [props.pct, "%"]
					})
				]
			});
		}
		/** One speculative probe card (interest or avoidance) with three actions. */
		function ProbeCard(props) {
			const { base, kind, domain, reason, confidence, onAnswered, onError } = props;
			const [busy, setBusy] = (0, react.useState)("");
			const answer = (0, react.useCallback)(async (response) => {
				setBusy(response);
				try {
					if (kind === "interest") await respondInterestProbe(base, {
						domain,
						response
					});
					else await respondAvoidanceProbe(base, {
						domain,
						response
					});
					onAnswered();
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				domain,
				kind,
				onAnswered,
				onError
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.probe,
				"data-tone": kind,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.probeHead,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.probeDomain,
							children: domain
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.probeConfidence,
							children: [Math.round(confidence * 100), "%"]
						})]
					}),
					reason !== "" ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.probeReason,
						children: reason
					}) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.probeActions,
						children: [
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "确实",
								primary: true,
								disabled: busy !== "",
								onClick: () => void answer("confirm")
							}),
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "放一放",
								disabled: busy !== "",
								onClick: () => void answer("defer")
							}),
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "不对",
								danger: true,
								disabled: busy !== "",
								onClick: () => void answer("reject")
							})
						]
					})
				]
			});
		}
		/** 画像 tab. */
		function ProfileView(props) {
			const { base } = props;
			const [profile, setProfile] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)("");
			const reload = (0, react.useCallback)(async () => {
				setError("");
				try {
					setProfile(await fetchProfileSummary(base));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [base]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			if (profile === void 0) return (0, react_jsx_runtime.jsx)(EmptyState, { text: "加载中…" });
			if (profile === null) return (0, react_jsx_runtime.jsx)(EmptyState, { text: "画像尚未生成（需要先完成初始化）。" });
			const activeInterests = profile.speculative_interests.filter((p) => p.status === "active");
			const activeAvoidances = profile.speculative_avoidances.filter((p) => p.status === "active");
			const styleBars = [];
			if (profile.style.quality_sensitivity > 0) styleBars.push({
				label: "质量敏感度",
				value: Math.round(profile.style.quality_sensitivity * 100)
			});
			if (profile.style.humor_preference > 0) styleBars.push({
				label: "幽默偏好",
				value: Math.round(profile.style.humor_preference * 100)
			});
			if (profile.style.depth_preference > 0) styleBars.push({
				label: "深度偏好",
				value: Math.round(profile.style.depth_preference * 100)
			});
			const contextRows = [];
			if (profile.context.weekday_patterns !== "") contextRows.push({
				label: "工作日",
				value: profile.context.weekday_patterns
			});
			if (profile.context.weekend_patterns !== "") contextRows.push({
				label: "周末",
				value: profile.context.weekend_patterns
			});
			if (profile.context.time_of_day_patterns !== "") contextRows.push({
				label: "时段",
				value: profile.context.time_of_day_patterns
			});
			if (profile.context.session_type !== "") contextRows.push({
				label: "场景",
				value: profile.context.session_type
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.viewIntro,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.viewKicker,
							children: "Profile"
						}),
						(0, react_jsx_runtime.jsx)("h2", { children: "我感觉你大概是这样的" }),
						(0, react_jsx_runtime.jsx)("p", { children: "不是光看你点过啥，我主要在看你会为哪种东西停下来。" })
					]
				}),
				error !== "" ? (0, react_jsx_runtime.jsx)(ErrorNote, { text: error }) : null,
				(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.profileCard,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.profileSummary,
							children: portraitParagraphs(profile.personality_portrait).map((paragraph, i) => (0, react_jsx_runtime.jsx)("p", {
								className: panel_module_css_default.profilePortraitP,
								children: paragraph
							}, i))
						}),
						(0, react_jsx_runtime.jsx)(Layer, { label: "Core — 比较稳定的底色" }),
						(0, react_jsx_runtime.jsx)(Group, {
							title: "核心特质",
							children: (0, react_jsx_runtime.jsx)(Chips, {
								chips: profile.core_traits,
								tone: "brand"
							})
						}),
						profile.deep_needs.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
							title: "深层需求",
							children: (0, react_jsx_runtime.jsx)(Chips, { chips: profile.deep_needs })
						}) : null,
						profile.mbti.type !== "" ? (0, react_jsx_runtime.jsx)(Group, {
							title: "MBTI",
							children: (0, react_jsx_runtime.jsx)(MbtiBlock, { mbti: profile.mbti })
						}) : null,
						profile.values.length > 0 || profile.motivational_drivers.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsx)(Layer, { label: "Values — 你在内容里长期在找什么" }),
							profile.values.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "价值偏好",
								children: (0, react_jsx_runtime.jsx)(Chips, {
									chips: profile.values,
									tone: "success"
								})
							}) : null,
							profile.motivational_drivers.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "内在驱动力",
								children: (0, react_jsx_runtime.jsx)(Chips, { chips: profile.motivational_drivers })
							}) : null
						] }) : null,
						profile.likes.length > 0 || profile.dislikes.length > 0 || profile.favorite_up_users.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsx)(Layer, { label: "Interest — 你最近在看什么" }),
							profile.likes.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "感兴趣的方向",
								children: (0, react_jsx_runtime.jsx)(InterestTree, {
									label: "喜欢",
									tone: "sky",
									domains: profile.likes
								})
							}) : null,
							profile.dislikes.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "明显会避开",
								children: (0, react_jsx_runtime.jsx)(InterestTree, {
									label: "不喜欢",
									tone: "danger",
									domains: profile.dislikes
								})
							}) : null,
							profile.favorite_up_users.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "常看的 UP 主",
								children: (0, react_jsx_runtime.jsx)(Chips, {
									chips: profile.favorite_up_users,
									tone: "brand"
								})
							}) : null
						] }) : null,
						profile.life_stage !== "" || profile.current_phase !== "" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Layer, { label: "Role — 这阵子的状态" }), (0, react_jsx_runtime.jsxs)(Group, { children: [profile.life_stage !== "" ? (0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.profilePhaseCopy,
							children: profile.life_stage
						}) : null, profile.current_phase !== "" ? (0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.profilePhaseCopy,
							children: profile.current_phase
						}) : null] })] }) : null,
						profile.cognitive_style.length > 0 || styleBars.length > 0 || contextRows.length > 0 || profile.exploration_openness > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsx)(Layer, { label: "Surface — 你怎么看内容" }),
							profile.cognitive_style.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "认知风格",
								children: (0, react_jsx_runtime.jsx)(Chips, { chips: profile.cognitive_style })
							}) : null,
							profile.style.preferred_duration !== "" || profile.style.preferred_pace !== "" ? (0, react_jsx_runtime.jsxs)(Group, {
								title: "口味",
								children: [profile.style.preferred_duration !== "" ? (0, react_jsx_runtime.jsxs)("p", {
									className: panel_module_css_default.profilePhaseCopy,
									children: ["喜欢时长：", profile.style.preferred_duration]
								}) : null, profile.style.preferred_pace !== "" ? (0, react_jsx_runtime.jsxs)("p", {
									className: panel_module_css_default.profilePhaseCopy,
									children: ["喜欢节奏：", profile.style.preferred_pace]
								}) : null]
							}) : null,
							styleBars.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "偏好",
								children: styleBars.map((bar) => (0, react_jsx_runtime.jsx)(BarRow, {
									label: bar.label,
									pct: bar.value
								}, bar.label))
							}) : null,
							profile.exploration_openness > 0 ? (0, react_jsx_runtime.jsx)(BarRow, {
								label: "探索开放度",
								pct: Math.round(profile.exploration_openness * 100)
							}) : null,
							contextRows.length > 0 ? (0, react_jsx_runtime.jsx)(Group, {
								title: "场景",
								children: contextRows.map((row) => (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.contextRow,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.contextLabel,
										children: row.label
									}), (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.contextValue,
										children: row.value
									})]
								}, row.label))
							}) : null
						] }) : null,
						activeInterests.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Layer, { label: "推测性兴趣" }), activeInterests.map((probe) => (0, react_jsx_runtime.jsx)(ProbeCard, {
							base,
							kind: "interest",
							domain: probe.domain,
							reason: probe.reason,
							confidence: probe.confidence,
							onAnswered: () => void reload(),
							onError: setError
						}, probe.domain))] }) : null,
						activeAvoidances.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Layer, { label: "推测性避雷" }), activeAvoidances.map((probe) => (0, react_jsx_runtime.jsx)(ProbeCard, {
							base,
							kind: "avoidance",
							domain: probe.domain,
							reason: probe.reason,
							confidence: probe.confidence,
							onAnswered: () => void reload(),
							onError: setError
						}, probe.domain))] }) : null,
						profile.active_insights.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Layer, { label: "活跃洞察" }), profile.active_insights.map((insight) => (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.insightCard,
							"data-validated": insight.validated || void 0,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.insightHead,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.insightTitle,
										children: insight.hypothesis
									}), insight.validated ? (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.insightValidated,
										children: "✓ 已验证"
									}) : null]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.insightConfidenceRow,
									children: [(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.insightConfidenceBar,
										children: (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.insightConfidenceFill,
											style: { width: `${Math.round(insight.confidence * 100)}%` }
										})
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: panel_module_css_default.insightConfidenceLabel,
										children: [Math.round(insight.confidence * 100), "%"]
									})]
								}),
								insight.evidence.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
									className: panel_module_css_default.insightEvidenceList,
									children: insight.evidence.map((line, i) => (0, react_jsx_runtime.jsx)("li", { children: line }, i))
								}) : null,
								(0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.insightNote,
									children: "请在「对话」的待聊确认里处理"
								})
							]
						}, insight.hypothesis))] }) : null,
						profile.recent_awareness.length > 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Layer, { label: "最近的觉察" }), (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.awarenessList,
							children: profile.recent_awareness.map((note) => (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.awarenessItem,
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.awarenessHeader,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: panel_module_css_default.awarenessItemDate,
											children: note.date !== "" ? note.date.slice(5, 10) : ""
										}), note.emotion_guess !== "" ? (0, react_jsx_runtime.jsxs)("span", {
											className: panel_module_css_default.awarenessEmotion,
											children: ["心情 · ", note.emotion_guess]
										}) : null]
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.awarenessObservation,
										children: note.observation
									}),
									note.trend !== "" ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.awarenessTrend,
										children: note.trend
									}) : null
								]
							}, `${note.date}:${note.observation}`))
						})] }) : null
					]
				})
			] });
		}
		//#endregion
		//#region lib/types/client/notifications.js
		/**
		* 消息 drawer — the same message system as the mobile web's messages overlay:
		* probe notifications (interest / avoidance / challenge) with the four-state
		* actions, delight surprise messages, and pending notification
		* recommendations. Badge = probe + delight + notification count.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Canonical probe action sets (same labels as the mobile web). */
		const INTEREST_ACTIONS = [
			{
				action: "confirm",
				label: "确认喜欢",
				primary: true
			},
			{
				action: "defer",
				label: "暂时搁置",
				primary: false
			},
			{
				action: "reject",
				label: "确认不喜欢",
				primary: false
			}
		];
		const AVOIDANCE_ACTIONS = [
			{
				action: "confirm",
				label: "确认避雷",
				primary: true
			},
			{
				action: "defer",
				label: "搁置避雷",
				primary: false
			},
			{
				action: "reject",
				label: "不是雷点",
				primary: false
			}
		];
		/** Dedupe helpers (same key scheme as probe-notification-helpers.js). */
		function probeKey(type, domain) {
			const normalized = domain.trim().toLowerCase();
			return normalized === "" ? "" : `${type === "avoidance.probe" ? "avoidance.probe" : "interest.probe"}:${normalized}`;
		}
		/** One probe message card with inline actions. */
		function ProbeMessage(props) {
			const { base, notice, onHandled, onError } = props;
			const [busy, setBusy] = (0, react.useState)("");
			const isAvoidance = notice.type === "avoidance.probe";
			const tone = isAvoidance ? "avoidance" : notice.challenge ? "challenge" : "interest";
			const actions = isAvoidance ? AVOIDANCE_ACTIONS : INTEREST_ACTIONS;
			const prompt = isAvoidance ? "想少看这类，就确认这是雷点；如果猜错了，点不是。" : notice.challenge ? "这是挑战方向，会把口味往侧边推一点；想继续试探就点喜欢，不准就点不喜欢。" : "想继续探索这个方向，就点喜欢；不准就点不喜欢。";
			const answer = (0, react.useCallback)(async (action) => {
				setBusy(action);
				try {
					if (isAvoidance) await respondAvoidanceProbe(base, {
						domain: notice.domain,
						response: action
					});
					else await respondInterestProbe(base, {
						domain: notice.domain,
						response: action
					});
					onHandled(notice.key);
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				isAvoidance,
				notice.domain,
				notice.key,
				onError,
				onHandled
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.messageCard,
				"data-tone": tone,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.messageType,
						children: [(0, react_jsx_runtime.jsx)(SearchIcon, {}), isAvoidance ? "避雷确认" : notice.challenge ? "挑战探针" : "兴趣探测"]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messagePrompt,
						children: prompt
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageTitle,
						children: notice.domain
					}),
					notice.reason !== "" ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageBody,
						children: notice.reason
					}) : null,
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageActions,
						children: actions.map((entry) => (0, react_jsx_runtime.jsx)(ActionButton, {
							label: entry.label,
							primary: entry.primary,
							disabled: busy !== "",
							onClick: () => void answer(entry.action)
						}, entry.action))
					})
				]
			});
		}
		/** One delight message card. */
		function DelightMessage(props) {
			const { base, notice, onHandled, onError } = props;
			const [busy, setBusy] = (0, react.useState)("");
			const act = (0, react.useCallback)(async (response) => {
				setBusy(response);
				try {
					await respondToDelight(base, {
						bvid: notice.bvid,
						response,
						title: notice.title,
						request_id: stableId()
					});
					onHandled(notice.bvid);
				} catch (err) {
					onError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy("");
				}
			}, [
				base,
				notice.bvid,
				notice.title,
				onError,
				onHandled
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.messageCard,
				"data-tone": "delight",
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageType,
						children: "✨ 惊喜推荐"
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageTitle,
						children: notice.title
					}),
					notice.reason !== "" ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageBody,
						children: notice.reason
					}) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.messageActions,
						children: [
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "去看看",
								primary: true,
								disabled: busy !== "",
								onClick: () => openItem(base, {
									recommendation_id: void 0,
									content_id: notice.content_id !== "" ? notice.content_id : notice.bvid,
									bvid: notice.bvid,
									content_url: notice.content_url,
									source_platform: notice.source_platform,
									title: notice.title
								})
							}),
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "已看",
								disabled: busy !== "",
								onClick: () => void act("view")
							}),
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "喜欢",
								disabled: busy !== "",
								onClick: () => void act("like")
							}),
							(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "不再推荐",
								disabled: busy !== "",
								onClick: () => void act("dismiss")
							})
						]
					})
				]
			});
		}
		/** One pending notification recommendation card. */
		function NotificationMessage(props) {
			const { base, notice, onHandled } = props;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.messageCard,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageType,
						children: "🔔 值得一看"
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageTitle,
						children: notice.title !== "" ? notice.title : notice.bvid
					}),
					notice.reason !== "" ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageBody,
						children: notice.reason
					}) : null,
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.messageActions,
						children: (0, react_jsx_runtime.jsx)(ActionButton, {
							label: "去看看",
							primary: true,
							onClick: () => {
								openItem(base, {
									content_id: notice.bvid,
									bvid: notice.bvid,
									content_url: "",
									source_platform: "bilibili",
									title: notice.title
								});
								onHandled(notice.bvid);
							}
						})
					})
				]
			});
		}
		/** The messages drawer (bell overlay). */
		function MessagesDrawer(props) {
			const { base, probes, delights, notifications, onClose, onProbeHandled, onDelightHandled, onNotificationHandled, onError } = props;
			const isEmpty = probes.length === 0 && delights.length === 0 && notifications.length === 0;
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.drawerOverlay,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.drawerPanel,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.drawerHeader,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.drawerTitle,
								children: "消息"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								onClick: onClose,
								title: "关闭",
								children: (0, react_jsx_runtime.jsx)(CloseIcon, { size: 13 })
							})]
						}),
						isEmpty ? (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.drawerEmpty,
							children: [
								(0, react_jsx_runtime.jsx)(MessageIcon, { size: 34 }),
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.drawerEmptyTitle,
									children: "暂时没有新消息"
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.drawerEmptySubtitle,
									children: "兴趣探测和惊喜推荐会出现在这里"
								})
							]
						}) : null,
						notifications.map((notice) => (0, react_jsx_runtime.jsx)(NotificationMessage, {
							base,
							notice,
							onHandled: onNotificationHandled
						}, `notif:${notice.bvid}`)),
						probes.map((notice) => (0, react_jsx_runtime.jsx)(ProbeMessage, {
							base,
							notice,
							onHandled: onProbeHandled,
							onError
						}, notice.key)),
						delights.map((notice) => (0, react_jsx_runtime.jsx)(DelightMessage, {
							base,
							notice,
							onHandled: onDelightHandled,
							onError
						}, `delight:${notice.bvid}`))
					]
				})
			});
		}
		/** Coerce one probe payload into a notice row. */
		function toProbeNotice(item, type) {
			return {
				key: probeKey(type, item.domain),
				type,
				domain: item.domain,
				reason: item.reason,
				challenge: (item.probe_mode ?? "") === "lateral" || (item.probe_mode ?? "") === "bridge" || (item.probe_mode ?? "") === "wildcard" || (item.challenge ?? "") === "true",
				confidence: item.confidence
			};
		}
		/** Build a delight notice from a delight payload. */
		function toDelightNotice(item) {
			return {
				bvid: item.bvid,
				title: item.title,
				reason: item.delight_reason,
				hook: item.delight_hook,
				source_platform: item.source_platform,
				content_url: item.content_url,
				content_id: item.content_id,
				score: item.delight_score
			};
		}
		/** Hydrate the drawer from the REST surfaces (probes + delights + notification). */
		async function hydrateDrawer(base, handledProbes) {
			const [interests, avoidances, delights, notification] = await Promise.all([
				fetchInterestProbes(base).catch(() => []),
				fetchAvoidanceProbes(base).catch(() => []),
				fetchDelightBatch(base).catch(() => []),
				fetchPendingNotification(base).catch(() => null)
			]);
			const probeNotice = (p, type) => {
				const key = probeKey(type, p.domain);
				if (key === "" || handledProbes.has(key)) return null;
				if ((p.status ?? "active") !== "active" && (p.status ?? "active") !== "pending") return null;
				return toProbeNotice(p, type);
			};
			return {
				probes: [...interests.map((p) => probeNotice(p, "interest.probe")).filter((n) => n !== null), ...avoidances.map((p) => probeNotice(p, "avoidance.probe")).filter((n) => n !== null)],
				delights: delights.map(toDelightNotice),
				notifications: notification !== null ? [{
					bvid: notification.bvid,
					title: notification.title,
					reason: notification.reason
				}] : []
			};
		}
		//#endregion
		//#region lib/types/client/settings.js
		/**
		* 设置 overlay — mirrors the popup's settings surface (header + back, tab bar,
		* section cards, one global 保存配置 bar with dirty tracking).
		* Tabs: 模型 / 调度 / 高级功能 / 通用 / 日志 — the platform-source tab is
		* intentionally absent (crawling configuration stays out of this plugin).
		* The 模型 tab is the popup's v2 instance model: named LLM instances, a
		* default call chain, per-module route overrides, embedding, and no-write
		* probes (`/api/config/probe-service` + `/api/config/discover-models`).
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Popup tab order (minus 平台源). */
		const TABS$1 = [
			{
				key: "models",
				label: "模型"
			},
			{
				key: "scheduler",
				label: "调度"
			},
			{
				key: "advanced",
				label: "高级功能"
			},
			{
				key: "general",
				label: "通用"
			},
			{
				key: "logging",
				label: "日志"
			}
		];
		const MODULES = [
			{
				key: "soul",
				label: "画像理解"
			},
			{
				key: "discovery",
				label: "内容发现"
			},
			{
				key: "recommendation",
				label: "推荐表达"
			},
			{
				key: "evaluation",
				label: "内容评估"
			}
		];
		const PROVIDER_OPTIONS = [
			{
				value: "openai",
				label: "OpenAI"
			},
			{
				value: "claude",
				label: "Claude"
			},
			{
				value: "gemini",
				label: "Gemini"
			},
			{
				value: "deepseek",
				label: "DeepSeek"
			},
			{
				value: "openrouter",
				label: "OpenRouter"
			},
			{
				value: "ollama",
				label: "Ollama"
			},
			{
				value: "openai_compatible",
				label: "OpenAI-compatible"
			}
		];
		const EMBEDDING_PROVIDERS = [
			{
				value: "",
				label: "(不启用 embedding)"
			},
			{
				value: "openai",
				label: "OpenAI"
			},
			{
				value: "gemini",
				label: "Gemini"
			},
			{
				value: "ollama",
				label: "Ollama (本地)"
			},
			{
				value: "openai_compatible",
				label: "OpenAI 协议兼容 (Together/vLLM/Azure 等)"
			},
			{
				value: "dashscope",
				label: "DashScope 阿里百炼 (qwen3-vl 多模态)"
			}
		];
		const EMBEDDING_FALLBACKS = [
			{
				value: "",
				label: "(不启用 fallback)"
			},
			{
				value: "openai",
				label: "OpenAI"
			},
			{
				value: "gemini",
				label: "Gemini"
			},
			{
				value: "ollama",
				label: "Ollama (本地)"
			},
			{
				value: "openai_compatible",
				label: "OpenAI 协议兼容 (Together/vLLM/Azure 等)"
			}
		];
		const REASONING_SUGGESTIONS = [
			"none",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/** Providers whose protocols carry a reasoning-effort field. */
		const REASONING_PROVIDERS = new Set([
			"openai",
			"claude",
			"gemini",
			"deepseek",
			"openrouter",
			"openai_compatible"
		]);
		const PROTOCOL_PROVIDERS = new Set(["openai", "openai_compatible"]);
		/** Defensive helpers over the raw config object. */
		function asDict(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function getNum(config, path, fallback) {
			const parts = path.split(".");
			let cur = config;
			for (const part of parts) {
				cur = asDict(cur)[part];
				if (cur === void 0 || cur === null) return fallback;
			}
			return typeof cur === "number" ? cur : Number(cur) || fallback;
		}
		function getStr(config, path, fallback = "") {
			const parts = path.split(".");
			let cur = config;
			for (const part of parts) {
				cur = asDict(cur)[part];
				if (cur === void 0 || cur === null) return fallback;
			}
			return typeof cur === "string" ? cur : fallback;
		}
		function getBool(config, path) {
			const parts = path.split(".");
			let cur = config;
			for (const part of parts) {
				cur = asDict(cur)[part];
				if (cur === void 0 || cur === null) return false;
			}
			return cur === true;
		}
		/** One labelled field row (popup .settings-field). */
		function Field(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.settingsField,
				children: [
					(0, react_jsx_runtime.jsx)("label", { children: props.label }),
					props.children,
					props.hint !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: panel_module_css_default.settingsHint,
						children: props.hint
					}) : null
				]
			});
		}
		/** One section card (popup .settings-section). */
		function Section(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.settingsSection,
				children: [(0, react_jsx_runtime.jsxs)("h3", { children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.sectionIcon,
						children: props.icon
					}),
					" ",
					props.title
				] }), props.children]
			});
		}
		/** Numeric input. */
		function NumInput(props) {
			return (0, react_jsx_runtime.jsx)("input", {
				type: "number",
				className: panel_module_css_default.settingsInput,
				min: props.min,
				max: props.max,
				step: props.step,
				value: Number.isFinite(props.value) ? props.value : "",
				onChange: (e) => props.onChange(Number(e.target.value))
			});
		}
		/** Text input. */
		function TextInput(props) {
			return (0, react_jsx_runtime.jsx)("input", {
				type: props.type ?? "text",
				className: panel_module_css_default.settingsInput,
				value: props.value,
				placeholder: props.placeholder,
				onChange: (e) => props.onChange(e.target.value)
			});
		}
		/** Select input. */
		function SelectInput(props) {
			return (0, react_jsx_runtime.jsx)("select", {
				className: panel_module_css_default.settingsInput,
				value: props.value,
				onChange: (e) => props.onChange(e.target.value),
				children: props.options.map((opt) => (0, react_jsx_runtime.jsx)("option", {
					value: opt.value,
					children: opt.label
				}, opt.value))
			});
		}
		/** Checkbox row. */
		function CheckField(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.settingsField,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.settingsFieldRow,
					children: [(0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: props.checked,
						onChange: (e) => props.onChange(e.target.checked)
					}), (0, react_jsx_runtime.jsx)("label", { children: props.label })]
				}), props.hint !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
					className: panel_module_css_default.settingsHint,
					children: props.hint
				}) : null]
			});
		}
		/** Probe / async status line (popup .settings-probe-status). */
		function ProbeStatus(props) {
			const line = props.busy ? "测试中…" : props.status;
			if (line === "") return null;
			return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.probeStatus,
				"data-tone": props.tone,
				role: "status",
				children: line
			});
		}
		function dedupeIds(items) {
			if (!Array.isArray(items)) return [];
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			for (const item of items) {
				const id = String(item ?? "").trim().toLowerCase();
				if (id !== "" && !seen.has(id)) {
					seen.add(id);
					out.push(id);
				}
			}
			return out;
		}
		/** Project the raw config document into the popup's editable draft. */
		function buildDraft(raw) {
			const llmRaw = asDict(raw.llm);
			const instances = {};
			for (const [rawId, rawInstance] of Object.entries(asDict(llmRaw.instances))) {
				const row = asDict(rawInstance);
				const id = String(rawId ?? "").trim().toLowerCase();
				if (id === "") continue;
				instances[id] = {
					name: getStr(row, "name", id),
					provider_type: getStr(row, "provider_type"),
					enabled: row.enabled !== false,
					api_key: getStr(row, "api_key"),
					model: getStr(row, "model"),
					base_url: getStr(row, "base_url"),
					auth_mode: getStr(row, "auth_mode"),
					api_flavor: getStr(row, "api_flavor"),
					http_referer: getStr(row, "http_referer"),
					x_title: getStr(row, "x_title"),
					reasoning_effort: getStr(row, "reasoning_effort"),
					num_ctx: Math.max(0, getNum(row, "num_ctx", 0))
				};
			}
			const routesRaw = asDict(llmRaw.routes);
			const routes = {};
			for (const module of MODULES) {
				const route = asDict(routesRaw[module.key]);
				routes[module.key] = {
					inherit: route.inherit !== false,
					chain: dedupeIds(route.chain)
				};
			}
			const embed = asDict(llmRaw.embedding);
			const sched = asDict(raw.scheduler);
			const disc = asDict(raw.discovery);
			const logging = asDict(raw.logging);
			return {
				llm: {
					instances,
					defaultChain: dedupeIds(llmRaw.default_chain),
					routes,
					concurrency: getNum(llmRaw, "concurrency", 4),
					timeout: getNum(llmRaw, "timeout", 1200),
					embedding: {
						provider: getStr(embed, "provider", "ollama"),
						fallbackProvider: getStr(embed, "fallback_provider"),
						apiKey: getStr(embed, "api_key"),
						baseUrl: getStr(embed, "base_url"),
						model: getStr(embed, "model"),
						threshold: getNum(embed, "similarity_threshold", .82)
					}
				},
				language: getStr(raw, "language", "zh"),
				dataDir: getStr(raw, "data_dir", "data"),
				dbPath: getStr(asDict(raw.storage), "db_path", "data/openbiliclaw.db"),
				network: {
					mode: getStr(asDict(raw.network), "mode", "system"),
					proxy: getStr(asDict(raw.network), "proxy")
				},
				autoSync: getBool(asDict(raw.saved_sync), "auto_sync_enabled"),
				scheduler: {
					pauseLlm: getBool(sched, "enabled") === false,
					poolTarget: getNum(sched, "pool_target_count", 300),
					accountSync: getNum(sched, "account_sync_interval_hours", 6),
					refreshCheck: getNum(sched, "refresh_check_interval_seconds", 60),
					signalThreshold: getNum(sched, "signal_event_threshold", 6),
					feedbackThreshold: getNum(sched, "feedback_batch_threshold", 3),
					trending: getNum(sched, "trending_refresh_minutes", 3),
					explore: getNum(sched, "explore_refresh_minutes", 3),
					discoveryLimit: getNum(sched, "discovery_limit", 30),
					pushInterval: getNum(sched, "proactive_push_interval_seconds", 120),
					speculatorIdle: getNum(sched, "speculator_idle_interval_minutes", 30),
					speculationInterval: getNum(sched, "speculation_interval_minutes", 10),
					speculationTtl: getNum(sched, "speculation_ttl_days", 3),
					speculationCooldown: getNum(sched, "speculation_cooldown_days", 7),
					speculationThreshold: getNum(sched, "speculation_confirmation_threshold", 3),
					speculationMaxActive: getNum(sched, "speculation_max_active", 5),
					speculationMaxPrimary: getNum(sched, "speculation_max_primary_interests", 15),
					speculationMaxSecondary: getNum(sched, "speculation_max_secondary_interests", 60),
					autoUpdate: getBool(sched, "auto_update_enabled"),
					autoUpdateInterval: getNum(sched, "auto_update_check_interval_hours", 6)
				},
				discovery: {
					visualProfile: getBool(disc, "visual_profile_enabled"),
					danmaku: getBool(disc, "danmaku_enabled"),
					danmakuLimit: getNum(disc, "danmaku_fetch_limit", 50),
					danmakuChars: getNum(disc, "danmaku_max_chars", 500),
					keyframe: getBool(disc, "keyframe_enabled"),
					keyframeFrames: getNum(disc, "keyframe_max_frames", 4),
					keyframeLimit: getNum(disc, "keyframe_fetch_limit", 50),
					multimodalEmbed: getBool(embed, "multimodal_enabled"),
					multimodalEval: getBool(disc, "multimodal_evaluation_enabled"),
					evalConcurrency: getNum(disc, "candidate_eval_concurrency", 3),
					mmBatch: getNum(disc, "multimodal_batch_size", 8),
					mmPx: getNum(disc, "multimodal_image_max_px", 384),
					mmQuality: getNum(disc, "multimodal_image_quality", 72),
					mmTimeout: getNum(disc, "multimodal_image_timeout_seconds", 6),
					keywordMode: getStr(disc, "keyword_generation_mode", "hybrid")
				},
				logging: {
					path: `${getStr(logging, "directory", "logs")}/${getStr(logging, "filename", "openbiliclaw.log")}`,
					level: getStr(logging, "level", "INFO"),
					fileLevel: getStr(logging, "file_level", "DEBUG"),
					maxFile: getNum(logging, "max_file_size_mb", 100),
					backups: getNum(logging, "backup_count", 1),
					budget: getNum(logging, "aggregate_budget_mb", 500),
					truncate: getNum(logging, "unmanaged_truncate_mb", 200),
					maxAge: getNum(logging, "unmanaged_max_age_days", 30)
				}
			};
		}
		/** The llm section sent to probe/discover endpoints (no-write drafts). */
		function buildLlmDraftConfig(draft) {
			return { llm: {
				routing_version: 2,
				instances: draft.llm.instances,
				default_chain: [...draft.llm.defaultChain],
				routes: Object.fromEntries(MODULES.map((module) => [module.key, {
					inherit: draft.llm.routes[module.key].inherit,
					chain: [...draft.llm.routes[module.key].chain]
				}]))
			} };
		}
		/** The full PUT /api/config payload, mirroring the popup's collectForm(). */
		function buildPayload(draft, raw) {
			const rawEmbedding = asDict(asDict(raw.llm).embedding);
			const rawLogging = asDict(raw.logging);
			const rawPath = `${getStr(rawLogging, "directory", "logs")}/${getStr(rawLogging, "filename", "openbiliclaw.log")}`;
			let directory;
			let filename;
			if (draft.logging.path.trim() === rawPath.trim()) {
				directory = getStr(rawLogging, "directory", "logs");
				filename = getStr(rawLogging, "filename", "openbiliclaw.log");
			} else {
				const trimmed = draft.logging.path.trim() !== "" ? draft.logging.path.trim() : rawPath;
				const idx = trimmed.lastIndexOf("/");
				directory = idx > 0 ? trimmed.slice(0, idx) : "logs";
				filename = idx > 0 ? trimmed.slice(idx + 1) : trimmed;
				if (filename === "") filename = "openbiliclaw.log";
			}
			return {
				language: draft.language,
				data_dir: draft.dataDir,
				llm: {
					routing_version: 2,
					instances: draft.llm.instances,
					default_chain: [...draft.llm.defaultChain],
					routes: Object.fromEntries(MODULES.map((module) => [module.key, {
						inherit: draft.llm.routes[module.key].inherit,
						chain: draft.llm.routes[module.key].inherit ? [] : [...draft.llm.routes[module.key].chain]
					}])),
					concurrency: draft.llm.concurrency,
					timeout: draft.llm.timeout,
					embedding: {
						...rawEmbedding,
						provider: draft.llm.embedding.provider,
						api_key: draft.llm.embedding.apiKey,
						base_url: draft.llm.embedding.baseUrl,
						model: draft.llm.embedding.model,
						similarity_threshold: draft.llm.embedding.threshold,
						fallback_enabled: draft.llm.embedding.fallbackProvider !== "",
						fallback_provider: draft.llm.embedding.fallbackProvider,
						multimodal_enabled: draft.discovery.multimodalEmbed
					}
				},
				storage: { db_path: draft.dbPath },
				network: {
					mode: draft.network.mode,
					proxy: draft.network.proxy
				},
				saved_sync: { auto_sync_enabled: draft.autoSync },
				discovery: {
					visual_profile_enabled: draft.discovery.visualProfile,
					danmaku_enabled: draft.discovery.danmaku,
					danmaku_fetch_limit: draft.discovery.danmakuLimit,
					danmaku_max_chars: draft.discovery.danmakuChars,
					keyframe_enabled: draft.discovery.keyframe,
					keyframe_max_frames: draft.discovery.keyframeFrames,
					keyframe_fetch_limit: draft.discovery.keyframeLimit,
					multimodal_evaluation_enabled: draft.discovery.multimodalEval,
					candidate_eval_concurrency: draft.discovery.evalConcurrency,
					multimodal_batch_size: draft.discovery.mmBatch,
					multimodal_image_max_px: draft.discovery.mmPx,
					multimodal_image_quality: draft.discovery.mmQuality,
					multimodal_image_timeout_seconds: draft.discovery.mmTimeout,
					keyword_generation_mode: draft.discovery.keywordMode
				},
				scheduler: {
					enabled: !draft.scheduler.pauseLlm,
					pool_target_count: draft.scheduler.poolTarget,
					account_sync_interval_hours: draft.scheduler.accountSync,
					refresh_check_interval_seconds: draft.scheduler.refreshCheck,
					signal_event_threshold: draft.scheduler.signalThreshold,
					feedback_batch_threshold: draft.scheduler.feedbackThreshold,
					trending_refresh_minutes: draft.scheduler.trending,
					explore_refresh_minutes: draft.scheduler.explore,
					discovery_limit: draft.scheduler.discoveryLimit,
					proactive_push_interval_seconds: draft.scheduler.pushInterval,
					speculator_idle_interval_minutes: draft.scheduler.speculatorIdle,
					speculation_interval_minutes: draft.scheduler.speculationInterval,
					speculation_ttl_days: draft.scheduler.speculationTtl,
					speculation_cooldown_days: draft.scheduler.speculationCooldown,
					speculation_confirmation_threshold: draft.scheduler.speculationThreshold,
					speculation_max_active: draft.scheduler.speculationMaxActive,
					speculation_max_primary_interests: draft.scheduler.speculationMaxPrimary,
					speculation_max_secondary_interests: draft.scheduler.speculationMaxSecondary,
					auto_update_enabled: draft.scheduler.autoUpdate,
					auto_update_check_interval_hours: draft.scheduler.autoUpdateInterval
				},
				logging: {
					level: draft.logging.level,
					file_level: draft.logging.fileLevel,
					directory,
					filename,
					max_file_size_mb: draft.logging.maxFile,
					backup_count: draft.logging.backups,
					aggregate_budget_mb: draft.logging.budget,
					unmanaged_truncate_mb: draft.logging.truncate,
					unmanaged_max_age_days: draft.logging.maxAge
				}
			};
		}
		function instanceEndpointSummary(instance) {
			const raw = instance.base_url.trim();
			if (raw === "") return "官方默认地址";
			try {
				const url = new URL(raw);
				return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
			} catch {
				return raw;
			}
		}
		function emptyInstance(providerType) {
			return {
				name: "",
				provider_type: providerType,
				enabled: true,
				api_key: "",
				model: "",
				base_url: "",
				auth_mode: "",
				api_flavor: "",
				http_referer: "",
				x_title: "",
				reasoning_effort: "",
				num_ctx: 0
			};
		}
		/** One ordered chain row (popup's default-chain / module-chain list item). */
		function ChainRow(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.chainRow,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: panel_module_css_default.chainName,
						children: props.label
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.chainBtn,
						disabled: props.first,
						onClick: props.onUp,
						title: "上移",
						children: "↑"
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.chainBtn,
						disabled: props.last,
						onClick: props.onDown,
						title: "下移",
						children: "↓"
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: panel_module_css_default.chainBtn,
						onClick: props.onRemove,
						title: "移除",
						children: "✕"
					})
				]
			});
		}
		/** Chain editor: ordered rows + add picker (popup .settings-llm-chain-list). */
		function ChainEditor(props) {
			const [pick, setPick] = (0, react.useState)("");
			const { ids, candidates, instances, onReorder, emptyText } = props;
			const labels = ids.map((id) => instances[id]?.name || id);
			const addable = candidates.filter((candidate) => !ids.includes(candidate.id));
			const add = () => {
				if (pick === "" || ids.includes(pick)) return;
				onReorder([...ids, pick]);
				setPick("");
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.chainEditor,
				children: [ids.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
					className: panel_module_css_default.settingsHint,
					children: emptyText
				}) : (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.chainList,
					children: ids.map((id, index) => (0, react_jsx_runtime.jsx)(ChainRow, {
						label: labels[index] ?? id,
						first: index === 0,
						last: index === ids.length - 1,
						onUp: () => {
							const next = [...ids];
							const a = next[index - 1];
							const b = next[index];
							if (a === void 0 || b === void 0) return;
							next[index - 1] = b;
							next[index] = a;
							onReorder(next);
						},
						onDown: () => {
							const next = [...ids];
							const a = next[index];
							const b = next[index + 1];
							if (a === void 0 || b === void 0) return;
							next[index] = a;
							next[index + 1] = b;
							onReorder(next);
						},
						onRemove: () => onReorder(ids.filter((_, i) => i !== index))
					}, id))
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.chainPicker,
					children: [(0, react_jsx_runtime.jsxs)("select", {
						className: panel_module_css_default.settingsInput,
						value: pick,
						onChange: (e) => setPick(e.target.value),
						"aria-label": "选择要加入链的实例",
						children: [(0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: addable.length === 0 ? "没有可加入的实例" : "选择实例…"
						}), addable.map((candidate) => (0, react_jsx_runtime.jsx)("option", {
							value: candidate.id,
							children: candidate.name
						}, candidate.id))]
					}), (0, react_jsx_runtime.jsx)(ActionButton, {
						label: "加入末尾",
						disabled: pick === "",
						onClick: add
					})]
				})]
			});
		}
		/** Instance add/edit dialog (popup .llm-instance-dialog equivalent). */
		function InstanceDialog(props) {
			const { dialog, instances, onChange, onSave, onClose, onProbe, onDiscover } = props;
			const value = dialog.value;
			const patch = (patchValue) => onChange({
				...dialog,
				value: {
					...value,
					...patchValue
				}
			});
			const providerType = value.provider_type;
			const hasKey = value.api_key !== "";
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.dialogOverlay,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.dialogCard,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.dialogHead,
							children: [(0, react_jsx_runtime.jsx)("h3", { children: dialog.isNew ? "新建实例" : `编辑实例 · ${value.name || dialog.id}` }), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.settingsBack,
								title: "关闭",
								onClick: onClose,
								children: "←"
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.dialogFields,
							children: [
								(0, react_jsx_runtime.jsx)(Field, {
									label: "名称",
									children: (0, react_jsx_runtime.jsx)(TextInput, {
										value: value.name,
										onChange: (v) => patch({ name: v }),
										placeholder: providerType || "实例名称"
									})
								}),
								(0, react_jsx_runtime.jsx)(Field, {
									label: "Provider",
									children: (0, react_jsx_runtime.jsx)(SelectInput, {
										value: providerType,
										options: PROVIDER_OPTIONS,
										onChange: (v) => {
											const next = {
												...value,
												provider_type: v
											};
											if (!REASONING_PROVIDERS.has(v)) next.reasoning_effort = "";
											if (!PROTOCOL_PROVIDERS.has(v)) next.api_flavor = "";
											if (v !== "openai") next.auth_mode = "";
											if (v !== "openrouter") {
												next.http_referer = "";
												next.x_title = "";
											}
											if (v !== "ollama") next.num_ctx = 0;
											patch(next);
										}
									})
								}),
								(0, react_jsx_runtime.jsx)(Field, {
									label: "状态",
									children: (0, react_jsx_runtime.jsx)(SelectInput, {
										value: value.enabled ? "enabled" : "disabled",
										options: [{
											value: "enabled",
											label: "启用"
										}, {
											value: "disabled",
											label: "停用"
										}],
										onChange: (v) => patch({ enabled: v === "enabled" })
									})
								}),
								(0, react_jsx_runtime.jsx)(Field, {
									label: "API Key",
									hint: hasKey ? "已保存（脱敏）。输入新值替换，或勾选下方清除。" : void 0,
									children: (0, react_jsx_runtime.jsx)(TextInput, {
										type: "password",
										value: dialog.typedKey,
										onChange: (v) => onChange({
											...dialog,
											typedKey: v
										}),
										placeholder: hasKey ? "••••••（已设置）" : "sk-..."
									})
								}),
								hasKey ? (0, react_jsx_runtime.jsx)(CheckField, {
									label: "清除已保存的 API Key",
									checked: dialog.clearKey,
									onChange: (v) => onChange({
										...dialog,
										clearKey: v
									})
								}) : null,
								(0, react_jsx_runtime.jsxs)(Field, {
									label: "Model",
									children: [(0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.dialogActionRow,
										children: [(0, react_jsx_runtime.jsx)(TextInput, {
											value: value.model,
											onChange: (v) => patch({ model: v }),
											placeholder: "留空使用 provider 默认"
										}), (0, react_jsx_runtime.jsx)(ActionButton, {
											label: "获取模型",
											disabled: dialog.discoverBusy,
											onClick: () => onDiscover(dialog)
										})]
									}), dialog.discoverStatus !== "" ? (0, react_jsx_runtime.jsx)("p", {
										className: panel_module_css_default.settingsHint,
										children: dialog.discoverStatus
									}) : null]
								}),
								(0, react_jsx_runtime.jsx)(Field, {
									label: "Base URL",
									children: (0, react_jsx_runtime.jsx)(TextInput, {
										value: value.base_url,
										onChange: (v) => patch({ base_url: v }),
										placeholder: "留空使用默认"
									})
								}),
								REASONING_PROVIDERS.has(providerType) ? (0, react_jsx_runtime.jsxs)(Field, {
									label: "Reasoning effort",
									hint: "留空不显式指定；协议没有 Effort 枚举接口，这里是本地建议，也支持手填。",
									children: [(0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: panel_module_css_default.settingsInput,
										list: "obc-reasoning-suggestions",
										value: value.reasoning_effort,
										placeholder: "Auto（留空不显式指定）",
										onChange: (e) => patch({ reasoning_effort: e.target.value })
									}), (0, react_jsx_runtime.jsx)("datalist", {
										id: "obc-reasoning-suggestions",
										children: REASONING_SUGGESTIONS.map((s) => (0, react_jsx_runtime.jsx)("option", { value: s }, s))
									})]
								}) : null,
								providerType === "openai" ? (0, react_jsx_runtime.jsx)(Field, {
									label: "OpenAI 认证方式",
									children: (0, react_jsx_runtime.jsx)(SelectInput, {
										value: value.auth_mode,
										options: [{
											value: "api_key",
											label: "API Key"
										}, {
											value: "codex_oauth",
											label: "Codex OAuth"
										}],
										onChange: (v) => patch({ auth_mode: v })
									})
								}) : null,
								PROTOCOL_PROVIDERS.has(providerType) ? (0, react_jsx_runtime.jsx)(Field, {
									label: "API 协议",
									children: (0, react_jsx_runtime.jsx)(SelectInput, {
										value: value.api_flavor,
										options: [{
											value: "",
											label: "chat/completions（默认）"
										}, {
											value: "responses",
											label: "responses"
										}],
										onChange: (v) => patch({ api_flavor: v })
									})
								}) : null,
								providerType === "ollama" ? (0, react_jsx_runtime.jsx)(Field, {
									label: "Ollama 上下文窗口",
									hint: "0 = 服务默认。",
									children: (0, react_jsx_runtime.jsx)(NumInput, {
										value: value.num_ctx,
										onChange: (v) => patch({ num_ctx: Math.max(0, v) }),
										min: 0
									})
								}) : null,
								providerType === "openrouter" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Field, {
									label: "HTTP Referer",
									children: (0, react_jsx_runtime.jsx)(TextInput, {
										value: value.http_referer,
										onChange: (v) => patch({ http_referer: v }),
										placeholder: "https://example.com"
									})
								}), (0, react_jsx_runtime.jsx)(Field, {
									label: "X-Title",
									children: (0, react_jsx_runtime.jsx)(TextInput, {
										value: value.x_title,
										onChange: (v) => patch({ x_title: v }),
										placeholder: "OpenBiliClaw"
									})
								})] }) : null
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.dialogActions,
							children: [
								(0, react_jsx_runtime.jsx)(ProbeStatus, {
									busy: dialog.probeBusy,
									status: dialog.probeStatus,
									tone: dialog.probeTone
								}),
								(0, react_jsx_runtime.jsx)(ActionButton, {
									label: "测试此实例",
									disabled: dialog.probeBusy,
									onClick: () => onProbe(dialog)
								}),
								(0, react_jsx_runtime.jsx)(ActionButton, {
									label: "保存实例",
									primary: true,
									disabled: value.name.trim() === "" && dialog.isNew,
									onClick: () => onSave(dialog)
								})
							]
						})
					]
				})
			});
		}
		function ModelsTab(props) {
			const { draft, patch, base } = props;
			const [dialog, setDialog] = (0, react.useState)(null);
			const [chainProbe, setChainProbe] = (0, react.useState)({
				busy: false,
				status: "",
				tone: "idle"
			});
			const [embeddingProbe, setEmbeddingProbe] = (0, react.useState)({
				busy: false,
				status: "",
				tone: "idle"
			});
			const llm = draft.llm;
			const instances = llm.instances;
			const candidates = Object.entries(instances).filter(([, instance]) => instance.enabled).map(([id, instance]) => ({
				id,
				name: instance.name || id
			}));
			const candidateSet = new Set(candidates.map((candidate) => candidate.id));
			const patchLlms = (0, react.useCallback)((fn) => {
				patch((d) => ({
					...d,
					llm: fn(d.llm)
				}));
			}, [patch]);
			const openNew = () => {
				setDialog({
					id: "",
					isNew: true,
					value: emptyInstance("openai"),
					typedKey: "",
					clearKey: false,
					probeBusy: false,
					probeStatus: "",
					probeTone: "idle",
					discoverBusy: false,
					discoverStatus: ""
				});
			};
			const openEdit = (id) => {
				const instance = instances[id];
				if (instance === void 0) return;
				setDialog({
					id,
					isNew: false,
					value: { ...instance },
					typedKey: "",
					clearKey: false,
					probeBusy: false,
					probeStatus: "",
					probeTone: "idle",
					discoverBusy: false,
					discoverStatus: ""
				});
			};
			const closeDialog = () => setDialog(null);
			const saveDialog = (current) => {
				let id = current.id.trim().toLowerCase();
				if (id === "") {
					let candidate = current.value.provider_type.replace(/_/g, "-") || "instance";
					let suffix = 2;
					while (instances[candidate] !== void 0) candidate = `${current.value.provider_type.replace(/_/g, "-")}-${suffix++}`;
					id = candidate;
				}
				const saved = { ...current.value };
				if (current.clearKey) saved.api_key = "";
				else if (current.typedKey !== "") saved.api_key = current.typedKey;
				patchLlms((l) => ({
					...l,
					instances: {
						...l.instances,
						[id]: saved
					}
				}));
				setDialog(null);
			};
			const removeInstance = (id) => {
				const references = [];
				if (llm.defaultChain.includes(id)) references.push("默认链");
				for (const module of MODULES) {
					const route = llm.routes[module.key];
					if (!route.inherit && route.chain.includes(id)) references.push(module.label);
				}
				const suffix = references.length > 0 ? `\n该实例仍被引用：${references.join("、")}，删除后会从这些链中移除。` : "";
				if (!window.confirm(`删除实例「${instances[id]?.name || id}」？${suffix}`)) return;
				patchLlms((l) => ({
					...l,
					instances: Object.fromEntries(Object.entries(l.instances).filter(([key]) => key !== id)),
					defaultChain: l.defaultChain.filter((key) => key !== id),
					routes: Object.fromEntries(MODULES.map((module) => [module.key, {
						inherit: l.routes[module.key].inherit,
						chain: l.routes[module.key].chain.filter((key) => key !== id)
					}]))
				}));
			};
			/** Probe the whole default chain with the current draft (no-write). */
			const probeChain = (0, react.useCallback)(async () => {
				setChainProbe({
					busy: true,
					status: "",
					tone: "idle"
				});
				try {
					const result = await probeConfigService(base, "llm_chain", buildLlmDraftConfig(draft));
					if (result.ok) setChainProbe({
						busy: false,
						status: `${result.message !== "" ? result.message : "链路正常"}（${result.latencyMs}ms）`,
						tone: "success"
					});
					else setChainProbe({
						busy: false,
						status: result.error !== "" ? result.error : result.message,
						tone: "error"
					});
				} catch (err) {
					setChainProbe({
						busy: false,
						status: "测试失败：" + (err instanceof Error ? err.message : String(err)),
						tone: "error"
					});
				}
			}, [base, draft]);
			const probeEmbedding = (0, react.useCallback)(async () => {
				setEmbeddingProbe({
					busy: true,
					status: "",
					tone: "idle"
				});
				try {
					const result = await probeConfigService(base, "embedding", buildLlmDraftConfig(draft));
					if (result.ok) setEmbeddingProbe({
						busy: false,
						status: `${result.message !== "" ? result.message : "嵌入服务正常"}（${result.latencyMs}ms）`,
						tone: "success"
					});
					else setEmbeddingProbe({
						busy: false,
						status: result.error !== "" ? result.error : result.message,
						tone: "error"
					});
				} catch (err) {
					setEmbeddingProbe({
						busy: false,
						status: "测试失败：" + (err instanceof Error ? err.message : String(err)),
						tone: "error"
					});
				}
			}, [base, draft]);
			/** Probe one dialog instance (kind llm_instance). */
			const probeDialog = (0, react.useCallback)(async (current) => {
				setDialog((prev) => prev === null ? prev : {
					...prev,
					probeBusy: true,
					probeStatus: "",
					probeTone: "idle"
				});
				const merged = { ...current.value };
				if (current.clearKey) merged.api_key = "";
				else if (current.typedKey !== "") merged.api_key = current.typedKey;
				const config = { llm: {
					routing_version: 2,
					instances: {
						...draft.llm.instances,
						[current.id || "probe-draft"]: merged
					},
					default_chain: [...draft.llm.defaultChain],
					routes: buildLlmDraftConfig(draft).llm ? buildLlmDraftConfig(draft).llm.routes : {}
				} };
				try {
					const result = await probeConfigService(base, "llm_instance", config, current.id || "probe-draft");
					setDialog((prev) => prev === null ? prev : {
						...prev,
						probeBusy: false,
						probeTone: result.ok ? "success" : "error",
						probeStatus: result.ok ? `${result.message !== "" ? result.message : "实例可达"}（${result.latencyMs}ms）` : result.error !== "" ? result.error : result.message
					});
				} catch (err) {
					setDialog((prev) => prev === null ? prev : {
						...prev,
						probeBusy: false,
						probeTone: "error",
						probeStatus: "测试失败：" + (err instanceof Error ? err.message : String(err))
					});
				}
			}, [base, draft]);
			const discoverDialog = (0, react.useCallback)(async (current) => {
				setDialog((prev) => prev === null ? prev : {
					...prev,
					discoverBusy: true,
					discoverStatus: ""
				});
				const merged = { ...current.value };
				if (current.clearKey) merged.api_key = "";
				else if (current.typedKey !== "") merged.api_key = current.typedKey;
				const instanceId = current.id.trim().toLowerCase() !== "" ? current.id.trim().toLowerCase() : current.value.provider_type.replace(/_/g, "-") || "draft";
				const config = { llm: {
					routing_version: 2,
					instances: {
						...draft.llm.instances,
						[instanceId]: merged
					},
					default_chain: [...draft.llm.defaultChain],
					routes: buildLlmDraftConfig(draft).llm ? buildLlmDraftConfig(draft).llm.routes : {}
				} };
				try {
					const result = await discoverConfigModels(base, instanceId, config);
					if (result.ok) {
						const msg = result.models.length > 0 ? `已获取 ${result.models.length} 个模型，可从列表选择：${result.models.slice(0, 8).join("、")}${result.models.length > 8 ? "…" : ""}` : "接口返回了空列表；保留当前手填值。";
						setDialog((prev) => prev === null ? prev : {
							...prev,
							discoverBusy: false,
							discoverStatus: msg,
							value: result.models.length === 1 ? {
								...prev.value,
								model: result.models[0] ?? prev.value.model
							} : prev.value
						});
					} else setDialog((prev) => prev === null ? prev : {
						...prev,
						discoverBusy: false,
						discoverStatus: result.error !== "" ? `获取失败：${result.error}` : "获取失败：端点没有返回模型列表"
					});
				} catch (err) {
					setDialog((prev) => prev === null ? prev : {
						...prev,
						discoverBusy: false,
						discoverStatus: "获取失败：" + (err instanceof Error ? err.message : String(err))
					});
				}
			}, [base, draft]);
			const chainCandidates = candidates.filter((candidate) => candidateSet.has(candidate.id));
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "⚡",
					title: "LLM 实例与调用链",
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.llmInstanceList,
							children: [Object.entries(instances).map(([id, instance]) => (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.llmInstance,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.llmInstanceMain,
									children: [(0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.llmInstanceHead,
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.llmInstanceName,
												children: instance.name || id
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.llmBadge,
												children: instance.provider_type !== "" ? instance.provider_type : id
											}),
											!instance.enabled ? (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.llmBadge,
												"data-tone": "off",
												children: "停用"
											}) : null
										]
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: panel_module_css_default.llmInstanceDetail,
										children: [
											instance.model !== "" ? instance.model : "未指定模型",
											" · ",
											instanceEndpointSummary(instance)
										]
									})]
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.llmInstanceActions,
									children: [(0, react_jsx_runtime.jsx)(ActionButton, {
										label: "编辑",
										onClick: () => openEdit(id)
									}), (0, react_jsx_runtime.jsx)(ActionButton, {
										label: "删除",
										onClick: () => removeInstance(id)
									})]
								})]
							}, id)), Object.keys(instances).length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: panel_module_css_default.settingsHint,
								children: "还没有实例。新建一个实例后，把它加入默认调用链。"
							}) : null]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.settingsActions,
							children: (0, react_jsx_runtime.jsx)(ActionButton, {
								label: "新建实例",
								primary: true,
								onClick: openNew
							})
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.chainSection,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.chainHead,
									children: [(0, react_jsx_runtime.jsx)("h4", { children: "默认调用链" }), (0, react_jsx_runtime.jsx)(ActionButton, {
										label: "测试整链",
										disabled: chainProbe.busy,
										onClick: () => void probeChain()
									})]
								}),
								(0, react_jsx_runtime.jsx)(ChainEditor, {
									ids: llm.defaultChain,
									candidates: chainCandidates,
									instances,
									onReorder: (next) => patchLlms((l) => ({
										...l,
										defaultChain: next
									})),
									emptyText: "默认链为空——把至少一个启用实例加入链，推荐请求才会执行。"
								}),
								(0, react_jsx_runtime.jsx)(ProbeStatus, {
									busy: chainProbe.busy,
									status: chainProbe.status,
									tone: chainProbe.tone
								})
							]
						})
					]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🧭",
					title: "模块路由",
					children: [MODULES.map((module) => {
						const route = llm.routes[module.key];
						const routeCandidates = chainCandidates.filter((candidate) => !route.chain.includes(candidate.id));
						return (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.moduleRoute,
							children: [(0, react_jsx_runtime.jsx)(CheckField, {
								label: `${module.label}：继承默认调用链`,
								checked: route.inherit,
								onChange: (inherit) => patchLlms((l) => ({
									...l,
									routes: {
										...l.routes,
										[module.key]: {
											inherit,
											chain: inherit ? [] : l.routes[module.key].chain
										}
									}
								}))
							}), !route.inherit ? (0, react_jsx_runtime.jsx)(ChainEditor, {
								ids: route.chain,
								candidates: routeCandidates,
								instances,
								onReorder: (next) => patchLlms((l) => ({
									...l,
									routes: {
										...l.routes,
										[module.key]: {
											...l.routes[module.key],
											chain: next
										}
									}
								})),
								emptyText: "自定义链尚未配置。"
							}) : null]
						}, module.key);
					}), (0, react_jsx_runtime.jsx)("p", {
						className: panel_module_css_default.settingsHint,
						children: "每项可覆盖默认调用链：取消继承后，为对应模块单独选择实例链。"
					})]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "⚙️",
					title: "请求参数",
					children: [(0, react_jsx_runtime.jsx)(Field, {
						label: "LLM 并发数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: llm.concurrency,
							onChange: (v) => patchLlms((l) => ({
								...l,
								concurrency: v
							})),
							min: 1,
							max: 16
						})
					}), (0, react_jsx_runtime.jsx)(Field, {
						label: "单实例超时（秒）",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: llm.timeout,
							onChange: (v) => patchLlms((l) => ({
								...l,
								timeout: v
							})),
							min: 10,
							max: 1200,
							step: 10
						})
					})]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🔍",
					title: "Embedding 模型",
					children: [
						(0, react_jsx_runtime.jsx)(Field, {
							label: "Provider",
							children: (0, react_jsx_runtime.jsx)(SelectInput, {
								value: llm.embedding.provider,
								options: EMBEDDING_PROVIDERS,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										provider: v
									}
								}))
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "备选 Provider",
							children: (0, react_jsx_runtime.jsx)(SelectInput, {
								value: llm.embedding.fallbackProvider,
								options: EMBEDDING_FALLBACKS,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										fallbackProvider: v
									}
								}))
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "Embedding API Key",
							children: (0, react_jsx_runtime.jsx)(TextInput, {
								type: "password",
								value: llm.embedding.apiKey,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										apiKey: v
									}
								})),
								placeholder: "sk-..."
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "Base URL (可选)",
							children: (0, react_jsx_runtime.jsx)(TextInput, {
								value: llm.embedding.baseUrl,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										baseUrl: v
									}
								})),
								placeholder: "留空使用默认"
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "Embedding Model",
							children: (0, react_jsx_runtime.jsx)(TextInput, {
								value: llm.embedding.model,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										model: v
									}
								})),
								placeholder: "留空 = 自动选择"
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "相似度阈值 (0~1)",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: llm.embedding.threshold,
								onChange: (v) => patchLlms((l) => ({
									...l,
									embedding: {
										...l.embedding,
										threshold: v
									}
								})),
								min: 0,
								max: 1,
								step: .01
							})
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.settingsActions,
							children: [(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "测试 Embedding",
								disabled: embeddingProbe.busy,
								onClick: () => void probeEmbedding()
							}), (0, react_jsx_runtime.jsx)(ProbeStatus, {
								busy: embeddingProbe.busy,
								status: embeddingProbe.status,
								tone: embeddingProbe.tone
							})]
						})
					]
				}),
				dialog !== null ? (0, react_jsx_runtime.jsx)(InstanceDialog, {
					dialog,
					instances,
					onChange: setDialog,
					onSave: saveDialog,
					onClose: closeDialog,
					onProbe: (current) => void probeDialog(current),
					onDiscover: (current) => void discoverDialog(current)
				}) : null
			] });
		}
		function SchedulerTab(props) {
			const { draft, patch, base, toast } = props;
			const [update, setUpdate] = (0, react.useState)(null);
			const [updateBusy, setUpdateBusy] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let cancelled = false;
				fetchUpdateStatus(base).then((status) => {
					if (cancelled) return;
					setUpdate({
						current: status.current_version,
						latest: status.latest_version !== "" ? status.latest_version : status.latest_tag,
						latestTag: status.latest_tag,
						state: status.state !== "" ? status.state : "unknown",
						reason: status.reason,
						lastCheck: status.last_check_at,
						error: status.error,
						mode: status.install_mode
					});
				}).catch(() => {
					if (!cancelled) setUpdate((prev) => prev ?? {
						current: "—",
						latest: "—",
						latestTag: "",
						state: "unknown",
						reason: "",
						lastCheck: "—",
						error: "无法读取更新状态（后端不可达）。",
						mode: ""
					});
				});
				return () => {
					cancelled = true;
				};
			}, [base]);
			const check = (0, react.useCallback)(async () => {
				setUpdateBusy("check");
				try {
					await checkBackendUpdate(base);
					const status = await fetchUpdateStatus(base);
					setUpdate({
						current: status.current_version,
						latest: status.latest_version !== "" ? status.latest_version : status.latest_tag,
						latestTag: status.latest_tag,
						state: status.state !== "" ? status.state : "unknown",
						reason: status.reason,
						lastCheck: status.last_check_at,
						error: status.error,
						mode: status.install_mode
					});
					toast("后端更新检查完成");
				} catch (err) {
					toast("后端更新检查失败：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setUpdateBusy("");
				}
			}, [base, toast]);
			const apply = (0, react.useCallback)(async () => {
				const tag = update?.latestTag ?? "";
				if (!window.confirm(`将后端更新到 ${tag !== "" ? tag : "最新版本"}，更新完成后后端会自动重启。继续吗？`)) return;
				setUpdateBusy("apply");
				try {
					await applyBackendUpdate(base, tag);
					toast("后端更新已开始，稍后会重启");
					const status = await fetchUpdateStatus(base);
					setUpdate({
						current: status.current_version,
						latest: status.latest_version !== "" ? status.latest_version : status.latest_tag,
						latestTag: status.latest_tag,
						state: status.state !== "" ? status.state : "unknown",
						reason: status.reason,
						lastCheck: status.last_check_at,
						error: status.error,
						mode: status.install_mode
					});
				} catch (err) {
					toast("后端更新未能开始：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setUpdateBusy("");
				}
			}, [
				base,
				toast,
				update
			]);
			const s = draft.scheduler;
			const set = (key, value) => patch((d) => ({
				...d,
				scheduler: {
					...d.scheduler,
					[key]: value
				}
			}));
			const canApply = update !== null && update.mode === "git" && update.state === "update_available" && update.latestTag !== "" && !update.latestTag.startsWith("desktop-v");
			const autoApplyUnsupported = update !== null && [
				"frozen",
				"docker",
				"unsupported"
			].includes(update.mode);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)(Section, {
				icon: "↻",
				title: "版本与更新",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.updateRow,
						children: [(0, react_jsx_runtime.jsx)("span", { children: "当前版本" }), (0, react_jsx_runtime.jsx)("strong", { children: update?.current ?? "…" })]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.updateRow,
						children: [(0, react_jsx_runtime.jsx)("span", { children: "最新版本" }), (0, react_jsx_runtime.jsx)("strong", { children: update?.latest ?? "…" })]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.updateRow,
						children: [(0, react_jsx_runtime.jsx)("span", { children: "更新状态" }), (0, react_jsx_runtime.jsx)("strong", { children: update?.state ?? "…" })]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.updateRow,
						children: [(0, react_jsx_runtime.jsx)("span", { children: "最近检查" }), (0, react_jsx_runtime.jsx)("strong", { children: update?.lastCheck ?? "…" })]
					}),
					update !== null && update.error !== "" ? (0, react_jsx_runtime.jsxs)("p", {
						className: panel_module_css_default.settingsHint,
						children: ["最近错误：", update.error]
					}) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.settingsActions,
						children: [(0, react_jsx_runtime.jsx)(ActionButton, {
							label: "立即检查",
							disabled: updateBusy !== "",
							onClick: () => void check()
						}), canApply ? (0, react_jsx_runtime.jsx)(ActionButton, {
							label: "立即应用",
							primary: true,
							disabled: updateBusy !== "",
							onClick: () => void apply()
						}) : null]
					})
				]
			}), (0, react_jsx_runtime.jsxs)(Section, {
				icon: "⏰",
				title: "调度",
				children: [
					(0, react_jsx_runtime.jsx)(CheckField, {
						label: "停止后台 LLM 请求",
						checked: s.pauseLlm,
						onChange: (v) => set("pauseLlm", v),
						hint: "开启后暂停定时发现、候选池预计算和画像更新中的 LLM / embedding 调用。"
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "候选池目标数量",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.poolTarget,
							onChange: (v) => set("poolTarget", v),
							min: 1,
							max: 600
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "账户同步间隔小时",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.accountSync,
							onChange: (v) => set("accountSync", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "刷新轮询秒数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.refreshCheck,
							onChange: (v) => set("refreshCheck", v),
							min: 15
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "行为触发阈值",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.signalThreshold,
							onChange: (v) => set("signalThreshold", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "反馈分析积累阈值",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.feedbackThreshold,
							onChange: (v) => set("feedbackThreshold", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "热门刷新分钟",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.trending,
							onChange: (v) => set("trending", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "探索刷新分钟",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.explore,
							onChange: (v) => set("explore", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "单轮发现上限",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.discoveryLimit,
							onChange: (v) => set("discoveryLimit", v),
							min: 1,
							max: 60
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "主动推送轮询秒数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.pushInterval,
							onChange: (v) => set("pushInterval", v),
							min: 30
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "猜测兴趣空闲检查分钟",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculatorIdle,
							onChange: (v) => set("speculatorIdle", v),
							min: 5
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "猜测兴趣间隔分钟",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationInterval,
							onChange: (v) => set("speculationInterval", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "猜测兴趣存活天数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationTtl,
							onChange: (v) => set("speculationTtl", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "猜测兴趣冷却天数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationCooldown,
							onChange: (v) => set("speculationCooldown", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "猜测确认阈值",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationThreshold,
							onChange: (v) => set("speculationThreshold", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "最大活跃猜测数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationMaxActive,
							onChange: (v) => set("speculationMaxActive", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "主要兴趣域上限",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationMaxPrimary,
							onChange: (v) => set("speculationMaxPrimary", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "次要兴趣项上限",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.speculationMaxSecondary,
							onChange: (v) => set("speculationMaxSecondary", v),
							min: 1
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.settingsField,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.settingsFieldRow,
							children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: s.autoUpdate,
								disabled: autoApplyUnsupported,
								onChange: (e) => set("autoUpdate", e.target.checked)
							}), (0, react_jsx_runtime.jsx)("label", { children: "自动更新后端" })]
						}), (0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.settingsHint,
							children: autoApplyUnsupported ? "当前安装方式不支持自动更新。" : "仅对 git / AI 安装的后端源码生效。"
						})]
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "自动更新检查间隔小时",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: s.autoUpdateInterval,
							onChange: (v) => set("autoUpdateInterval", v),
							min: 1
						})
					})
				]
			})] });
		}
		function AdvancedTab(props) {
			const { draft, patch } = props;
			const d = draft.discovery;
			const set = (key, value) => patch((doc) => ({
				...doc,
				discovery: {
					...doc.discovery,
					[key]: value
				}
			}));
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🎨",
					title: "推荐增强",
					children: [
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "启用 P1 用户视觉画像",
							checked: d.visualProfile,
							onChange: (v) => set("visualProfile", v),
							hint: "用封面视觉特征辅助画像（需要多模态能力）。"
						}),
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "启用 P2 弹幕语义",
							checked: d.danmaku,
							onChange: (v) => set("danmaku", v)
						}),
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "启用 P3 视频关键帧",
							checked: d.keyframe,
							onChange: (v) => set("keyframe", v)
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "P3 每个视频采样关键帧数",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.keyframeFrames,
								onChange: (v) => set("keyframeFrames", v),
								min: 1,
								max: 12
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "P3 关键帧预热视频数上限",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.keyframeLimit,
								onChange: (v) => set("keyframeLimit", v),
								min: 1,
								max: 200
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "P2 弹幕预热视频数上限",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.danmakuLimit,
								onChange: (v) => set("danmakuLimit", v),
								min: 1,
								max: 200
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "P2 弹幕摘要字数上限",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.danmakuChars,
								onChange: (v) => set("danmakuChars", v),
								min: 100,
								max: 2e3
							})
						})
					]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🧠",
					title: "多模态处理",
					children: [
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "启用图像 Embedding 能力",
							checked: d.multimodalEmbed,
							onChange: (v) => set("multimodalEmbed", v),
							hint: "封面图片参与向量化。"
						}),
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "候选封面参与 LLM 评估",
							checked: d.multimodalEval,
							onChange: (v) => set("multimodalEval", v)
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "候选评估并发",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.evalConcurrency,
								onChange: (v) => set("evalConcurrency", v),
								min: 1,
								max: 3
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "图文评估批量大小",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.mmBatch,
								onChange: (v) => set("mmBatch", v),
								min: 1,
								max: 12
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "评估封面最大边 px",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.mmPx,
								onChange: (v) => set("mmPx", v),
								min: 128,
								max: 768
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "评估 JPEG 质量",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.mmQuality,
								onChange: (v) => set("mmQuality", v),
								min: 40,
								max: 90
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "评估封面超时秒数",
							children: (0, react_jsx_runtime.jsx)(NumInput, {
								value: d.mmTimeout,
								onChange: (v) => set("mmTimeout", v),
								min: 1,
								max: 20
							})
						})
					]
				}),
				(0, react_jsx_runtime.jsx)(Section, {
					icon: "🔑",
					title: "搜索词生成",
					children: (0, react_jsx_runtime.jsx)(Field, {
						label: "搜索词生成模式",
						children: (0, react_jsx_runtime.jsx)(SelectInput, {
							value: d.keywordMode,
							options: [
								{
									value: "legacy",
									label: "经典"
								},
								{
									value: "hybrid",
									label: "混合"
								},
								{
									value: "inspiration",
									label: "灵感"
								}
							],
							onChange: (v) => set("keywordMode", v)
						})
					})
				})
			] });
		}
		function GeneralTab(props) {
			const { draft, patch, base, onBaseChange, toast } = props;
			const [apiBase, setApiBase] = (0, react.useState)(() => readApiBase());
			const [localToast, setLocalToast] = (0, react.useState)("");
			const [proxyBusy, setProxyBusy] = (0, react.useState)(false);
			const [proxyStatus, setProxyStatus] = (0, react.useState)("");
			const [proxyTone, setProxyTone] = (0, react.useState)("idle");
			const [auth, setAuth] = (0, react.useState)({
				loaded: false,
				enabled: false
			});
			const [authEnabled, setAuthEnabled] = (0, react.useState)(false);
			const [authPassword, setAuthPassword] = (0, react.useState)("");
			const [authBusy, setAuthBusy] = (0, react.useState)(false);
			const [autostart, setAutostart] = (0, react.useState)({
				loaded: false,
				enabled: false,
				busy: false
			});
			const [init, setInit] = (0, react.useState)({
				loaded: false,
				initialized: false,
				running: false
			});
			const [reinitBusy, setReinitBusy] = (0, react.useState)(false);
			const [resetCognition, setResetCognition] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				fetchAuthStatus(base).then((status) => {
					if (!cancelled) {
						setAuth({
							loaded: true,
							enabled: status.enabled
						});
						setAuthEnabled(status.enabled);
					}
				}).catch(() => {
					if (!cancelled) setAuth({
						loaded: true,
						enabled: false
					});
				});
				fetchAutostartStatus(base).then((status) => {
					if (!cancelled) setAutostart((prev) => ({
						...prev,
						loaded: true,
						enabled: status.enabled
					}));
				}).catch(() => {
					if (!cancelled) setAutostart((prev) => ({
						...prev,
						loaded: true
					}));
				});
				fetchInitStatus(base).then((status) => {
					if (!cancelled) setInit({
						loaded: true,
						initialized: status.initialized,
						running: status.running
					});
				}).catch(() => {
					if (!cancelled) setInit((prev) => ({
						...prev,
						loaded: true
					}));
				});
				return () => {
					cancelled = true;
				};
			}, [base]);
			const saveBase = () => {
				const next = apiBase.trim() !== "" ? apiBase.trim() : DEFAULT_API_BASE;
				writeApiBase(next);
				onBaseChange(next);
				setLocalToast("连接地址已保存（面板立即生效）。");
			};
			const probeProxy = (0, react.useCallback)(async () => {
				setProxyBusy(true);
				setProxyStatus("");
				try {
					const result = await probeConfigService(base, "network_proxy", { network: {
						mode: draft.network.mode,
						proxy: draft.network.proxy
					} });
					if (result.ok) {
						setProxyTone("success");
						setProxyStatus(result.message !== "" ? result.message : "代理连通（" + result.latencyMs + "ms）");
					} else {
						setProxyTone("error");
						setProxyStatus(result.error !== "" ? result.error : result.message);
					}
				} catch (err) {
					setProxyTone("error");
					setProxyStatus("测试失败：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setProxyBusy(false);
				}
			}, [base, draft]);
			const saveAuth = (0, react.useCallback)(async () => {
				if (authEnabled && authPassword.trim() === "") {
					toast("启用局域网访问密码时必须填写密码");
					return;
				}
				setAuthBusy(true);
				try {
					if (!await setLanAuth(base, authEnabled, authPassword.trim())) throw new Error("后端拒绝了密码设置");
					toast("密码设置已保存。");
					setAuthPassword("");
					const status = await fetchAuthStatus(base);
					setAuth({
						loaded: true,
						enabled: status.enabled
					});
					setAuthEnabled(status.enabled);
				} catch (err) {
					toast("密码设置失败：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setAuthBusy(false);
				}
			}, [
				authEnabled,
				authPassword,
				base,
				toast
			]);
			const toggleAutostart = (0, react.useCallback)(async (enabled) => {
				setAutostart((prev) => ({
					...prev,
					busy: true
				}));
				try {
					if (!await applyAutostart(base, enabled)) throw new Error("后端拒绝了开机自启动设置");
					setAutostart((prev) => ({
						...prev,
						busy: false,
						enabled
					}));
					toast(enabled ? "开机自启动已开启。" : "开机自启动已关闭。");
				} catch (err) {
					setAutostart((prev) => ({
						...prev,
						busy: false
					}));
					toast("设置失败：" + (err instanceof Error ? err.message : String(err)));
				}
			}, [base, toast]);
			const reinit = (0, react.useCallback)(async () => {
				if (!init.loaded || init.running || !init.initialized) return;
				if (!window.confirm("将重新拉取所选平台的数据、重建完整画像并补足首轮发现池。现有推荐池会按新画像清空重建；现有事件、收藏、对话历史与手动编辑保留。重新初始化前会自动创建备份（数据库 + 画像/认知层）到 data/backups/。并消耗较多 AI 调用。继续吗？" + (resetCognition ? "\n\n已勾选「同时清空旧认知观察与洞察」：旧的 LLM 观察笔记与洞察将被删除（已包含在自动备份中），本轮重新生成。" : ""))) return;
				setReinitBusy(true);
				try {
					const payload = { force: true };
					if (resetCognition) payload.reset_cognition = true;
					await startInit(base, payload);
					toast("重新初始化已开始，正在重新拉取数据并重建画像");
					setInit((prev) => ({
						...prev,
						running: true
					}));
				} catch (err) {
					toast("重新初始化没能启动：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setReinitBusy(false);
				}
			}, [
				base,
				init,
				resetCognition,
				toast
			]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🔗",
					title: "连接",
					children: [(0, react_jsx_runtime.jsx)(Field, {
						label: "后端地址",
						hint: "OpenBiliClaw 本地 API 地址（含 /api/* 与 /api/runtime-stream）。",
						children: (0, react_jsx_runtime.jsx)(TextInput, {
							value: apiBase,
							onChange: setApiBase,
							placeholder: DEFAULT_API_BASE
						})
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.settingsActions,
						children: [(0, react_jsx_runtime.jsx)(ActionButton, {
							label: "保存连接地址",
							primary: true,
							onClick: saveBase
						}), localToast !== "" ? (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.settingsToast,
							role: "status",
							children: localToast
						}) : null]
					})]
				}),
				(0, react_jsx_runtime.jsx)(Section, {
					icon: "🌐",
					title: "语言",
					children: (0, react_jsx_runtime.jsx)(Field, {
						label: "界面语言",
						children: (0, react_jsx_runtime.jsx)(SelectInput, {
							value: draft.language,
							options: [{
								value: "zh",
								label: "中文"
							}, {
								value: "en",
								label: "English"
							}],
							onChange: (v) => patch((d) => ({
								...d,
								language: v
							}))
						})
					})
				}),
				(0, react_jsx_runtime.jsx)(Section, {
					icon: "💾",
					title: "保存与平台同步",
					children: (0, react_jsx_runtime.jsx)(CheckField, {
						label: "保存时自动同步到对应平台",
						checked: draft.autoSync,
						onChange: (v) => {
							if (v && !window.confirm("开启后，在 OpenBiliClaw 点击收藏或稍后再看会修改对应平台账号中的收藏、书签、Saved、播放列表或稍后观看。")) return;
							patch((d) => ({
								...d,
								autoSync: v
							}));
						},
						hint: "默认关闭。收藏和稍后再看始终先保存在本地；关闭时仍可在列表页手动同步。"
					})
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🗂️",
					title: "数据",
					children: [(0, react_jsx_runtime.jsx)(Field, {
						label: "数据目录",
						children: (0, react_jsx_runtime.jsx)(TextInput, {
							value: draft.dataDir,
							onChange: (v) => patch((d) => ({
								...d,
								dataDir: v
							})),
							placeholder: "data"
						})
					}), (0, react_jsx_runtime.jsx)(Field, {
						label: "SQLite 数据库路径",
						children: (0, react_jsx_runtime.jsx)(TextInput, {
							value: draft.dbPath,
							onChange: (v) => patch((d) => ({
								...d,
								dbPath: v
							})),
							placeholder: "data/openbiliclaw.db"
						})
					})]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🌍",
					title: "海外网络",
					children: [
						(0, react_jsx_runtime.jsx)(Field, {
							label: "海外网络模式",
							children: (0, react_jsx_runtime.jsx)(SelectInput, {
								value: draft.network.mode,
								options: [
									{
										value: "direct",
										label: "直连（忽略系统代理）"
									},
									{
										value: "system",
										label: "跟随系统代理"
									},
									{
										value: "custom",
										label: "自定义代理"
									}
								],
								onChange: (v) => patch((d) => ({
									...d,
									network: {
										...d.network,
										mode: v
									}
								}))
							})
						}),
						(0, react_jsx_runtime.jsx)(Field, {
							label: "自定义代理地址",
							children: (0, react_jsx_runtime.jsx)(TextInput, {
								value: draft.network.proxy,
								onChange: (v) => patch((d) => ({
									...d,
									network: {
										...d.network,
										proxy: v
									}
								})),
								placeholder: "socks5://127.0.0.1:1080"
							})
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.settingsHint,
							children: "仅作用于海外服务（海外 AI 服务、需要海外出网的内容来源、更新检查）；B 站等国内请求始终直连。直连会忽略环境代理；自定义模式支持 http/https/socks5/socks5h。"
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.settingsActions,
							children: [(0, react_jsx_runtime.jsx)(ActionButton, {
								label: "测试代理",
								disabled: proxyBusy,
								onClick: () => void probeProxy()
							}), (0, react_jsx_runtime.jsx)(ProbeStatus, {
								busy: proxyBusy,
								status: proxyStatus,
								tone: proxyTone
							})]
						})
					]
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🔐",
					title: "局域网访问密码",
					children: [
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "启用局域网访问密码",
							checked: authEnabled,
							onChange: (v) => {
								setAuthEnabled(v);
								if (!v) setAuthPassword("");
							},
							hint: auth.loaded ? auth.enabled ? "当前已启用；取消勾选并保存可关闭。" : "当前未启用。" : "读取鉴权状态中…"
						}),
						authEnabled ? (0, react_jsx_runtime.jsx)(Field, {
							label: "访问密码",
							children: (0, react_jsx_runtime.jsx)(TextInput, {
								type: "password",
								value: authPassword,
								onChange: setAuthPassword,
								placeholder: "设置 / 修改访问密码"
							})
						}) : null,
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.settingsActions,
							children: (0, react_jsx_runtime.jsx)(ActionButton, {
								label: "保存密码设置",
								primary: true,
								disabled: authBusy,
								onClick: () => void saveAuth()
							})
						})
					]
				}),
				(0, react_jsx_runtime.jsx)(Section, {
					icon: "🚀",
					title: "开机自启动",
					children: (0, react_jsx_runtime.jsx)(CheckField, {
						label: "开机自动启动 OpenBiliClaw 后端",
						checked: autostart.enabled,
						onChange: (v) => void toggleAutostart(v),
						hint: autostart.loaded ? autostart.busy ? "正在应用…" : void 0 : "读取开机自启动状态中…"
					})
				}),
				(0, react_jsx_runtime.jsxs)(Section, {
					icon: "🧹",
					title: "重新初始化 / 重建画像",
					children: [
						(0, react_jsx_runtime.jsx)("p", {
							className: panel_module_css_default.settingsHint,
							children: !init.loaded ? "读取初始化状态中…" : init.running ? "初始化正在进行中，请等待完成后再重新初始化。" : init.initialized ? "系统已初始化。重新初始化会重新拉取数据并重建画像，现有事件与收藏保留。" : "系统尚未初始化完成；正常流程请到「推荐」页点击开始初始化。"
						}),
						(0, react_jsx_runtime.jsx)(CheckField, {
							label: "同时清空旧认知观察与洞察（换账号 / 大改兴趣时建议）",
							checked: resetCognition,
							onChange: setResetCognition
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.settingsActions,
							children: (0, react_jsx_runtime.jsx)(ActionButton, {
								label: "开始重新初始化",
								primary: true,
								disabled: reinitBusy || !init.loaded || init.running || !init.initialized,
								onClick: () => void reinit()
							})
						})
					]
				})
			] });
		}
		function LoggingTab(props) {
			const { draft, patch } = props;
			const l = draft.logging;
			const set = (key, value) => patch((d) => ({
				...d,
				logging: {
					...d.logging,
					[key]: value
				}
			}));
			const levels = [
				"DEBUG",
				"INFO",
				"WARNING",
				"ERROR"
			].map((v) => ({
				value: v,
				label: v
			}));
			return (0, react_jsx_runtime.jsxs)(Section, {
				icon: "📄",
				title: "日志",
				children: [
					(0, react_jsx_runtime.jsx)(Field, {
						label: "控制台级别",
						children: (0, react_jsx_runtime.jsx)(SelectInput, {
							value: l.level,
							options: levels,
							onChange: (v) => set("level", v)
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "文件级别",
						children: (0, react_jsx_runtime.jsx)(SelectInput, {
							value: l.fileLevel,
							options: levels,
							onChange: (v) => set("fileLevel", v)
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "完整日志路径",
						hint: "目录与文件名（例如 logs/openbiliclaw.log）。",
						children: (0, react_jsx_runtime.jsx)(TextInput, {
							value: l.path,
							onChange: (v) => set("path", v),
							placeholder: "logs/openbiliclaw.log"
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "单日志文件上限 MB",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: l.maxFile,
							onChange: (v) => set("maxFile", v),
							min: 0
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "日志备份份数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: l.backups,
							onChange: (v) => set("backups", v),
							min: 0
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "日志目录预算 MB",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: l.budget,
							onChange: (v) => set("budget", v),
							min: 0
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "单个非托管日志截断 MB",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: l.truncate,
							onChange: (v) => set("truncate", v),
							min: 0
						})
					}),
					(0, react_jsx_runtime.jsx)(Field, {
						label: "非托管日志保留天数",
						children: (0, react_jsx_runtime.jsx)(NumInput, {
							value: l.maxAge,
							onChange: (v) => set("maxAge", v),
							min: 0
						})
					})
				]
			});
		}
		/** The settings overlay. */
		function SettingsOverlay(props) {
			const { base, onBaseChange, onClose } = props;
			const [tab, setTab] = (0, react.useState)("models");
			const [config, setConfig] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(null);
			const [saved, setSaved] = (0, react.useState)("");
			const [toast, setToast] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				fetchConfig(base).then((raw) => {
					if (cancelled) return;
					const next = buildDraft(raw);
					setConfig(raw);
					setDraft(next);
					setSaved(JSON.stringify(next));
				}).catch(() => {
					if (cancelled) return;
					const next = buildDraft({});
					setConfig({});
					setDraft(next);
					setSaved(JSON.stringify(next));
				});
				return () => {
					cancelled = true;
				};
			}, [base]);
			const patch = (0, react.useCallback)((fn) => {
				setDraft((prev) => prev === null ? prev : fn(prev));
			}, []);
			const dirty = draft !== null && JSON.stringify(draft) !== saved;
			const saveAll = (0, react.useCallback)(async () => {
				if (draft === null) return;
				setSaving(true);
				try {
					await updateConfig(base, buildPayload(draft, config ?? {}));
					setToast("配置已保存并热重载。");
					const raw = await fetchConfig(base);
					const next = buildDraft(raw);
					setConfig(raw);
					setDraft(next);
					setSaved(JSON.stringify(next));
				} catch (err) {
					setToast("保存失败：" + (err instanceof Error ? err.message : String(err)));
				} finally {
					setSaving(false);
				}
			}, [
				base,
				config,
				draft
			]);
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.settingsOverlay,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.settingsPanel,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.settingsHeader,
							children: [(0, react_jsx_runtime.jsx)("h2", { children: "后端设置" }), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.settingsBack,
								title: "返回",
								onClick: onClose,
								children: "←"
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.settingsTabs,
							role: "tablist",
							children: TABS$1.map((item) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.settingsTab,
								"data-active": tab === item.key,
								onClick: () => setTab(item.key),
								children: item.label
							}, item.key))
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.settingsBody,
							children: [toast !== "" ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.settingsToastBar,
								role: "status",
								children: toast
							}) : null, draft === null ? (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.empty,
								children: "配置加载中…"
							}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsx)("div", {
									hidden: tab !== "models",
									children: (0, react_jsx_runtime.jsx)(ModelsTab, {
										draft,
										patch,
										base
									})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									hidden: tab !== "scheduler",
									children: (0, react_jsx_runtime.jsx)(SchedulerTab, {
										draft,
										patch,
										base,
										toast: setToast
									})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									hidden: tab !== "advanced",
									children: (0, react_jsx_runtime.jsx)(AdvancedTab, {
										draft,
										patch
									})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									hidden: tab !== "general",
									children: (0, react_jsx_runtime.jsx)(GeneralTab, {
										draft,
										patch,
										base,
										onBaseChange,
										toast: setToast
									})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									hidden: tab !== "logging",
									children: (0, react_jsx_runtime.jsx)(LoggingTab, {
										draft,
										patch
									})
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.settingsSavebar,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.settingsSavebarMsg,
										"aria-live": "polite",
										children: dirty ? "有未保存的修改" : "没有未保存的修改"
									}), (0, react_jsx_runtime.jsx)(ActionButton, {
										label: "保存配置",
										primary: true,
										disabled: !dirty || saving,
										onClick: () => void saveAll()
									})]
								})
							] })]
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/OpenBiliClawPanel.js
		/**
		* OpenBiliClaw sidebar panel shell: brand header with the message bell
		* (badge + 消息 drawer), tab bar with SVG icons, and the active view. Live
		* runtime-stream events feed the probe/delight notifications and tab badges.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Canonical tab structure (same IA as the mobile web + extension popup). */
		const TABS = [
			{
				key: "recommend",
				label: "推荐",
				icon: SparkleIcon
			},
			{
				key: "library",
				label: "内容库",
				icon: LibraryIcon
			},
			{
				key: "chat",
				label: "对话",
				icon: ChatIcon
			},
			{
				key: "profile",
				label: "画像",
				icon: ProfileIcon
			}
		];
		/**
		* The aside occupant: OpenBiliClaw user-consumption sidebar.
		* @param props - runtime share + injected actions.
		*/
		function OpenBiliClawPanel({ closeAside, isDark, onThemeChange }) {
			const [dark, setDark] = (0, react.useState)(() => isDark());
			(0, react.useEffect)(() => onThemeChange(setDark), [onThemeChange]);
			const [base, setBase] = (0, react.useState)(() => readApiBase());
			const [online, setOnline] = (0, react.useState)(false);
			const [settingsOpen, setSettingsOpen] = (0, react.useState)(false);
			const [tab, setTab] = (0, react.useState)("recommend");
			const [badges, setBadges] = (0, react.useState)({});
			const [drawerOpen, setDrawerOpen] = (0, react.useState)(false);
			const [probes, setProbes] = (0, react.useState)([]);
			const [delights, setDelights] = (0, react.useState)([]);
			const [notifications, setNotifications] = (0, react.useState)([]);
			const [drawerError, setDrawerError] = (0, react.useState)("");
			const handledProbes = (0, react.useRef)(/* @__PURE__ */ new Set());
			const probeRef = (0, react.useRef)([]);
			probeRef.current = probes;
			const healthProbeRef = (0, react.useRef)(null);
			const failStreakRef = (0, react.useRef)(0);
			const probeNow = (0, react.useCallback)(() => {
				fetchHealth(base).then((ok) => {
					if (ok) {
						failStreakRef.current = 0;
						setOnline(true);
					} else {
						failStreakRef.current += 1;
						if (failStreakRef.current >= 2) setOnline(false);
					}
				});
			}, [base]);
			healthProbeRef.current = probeNow;
			(0, react.useEffect)(() => {
				probeNow();
				const timer = window.setInterval(probeNow, 12e3);
				return () => {
					window.clearInterval(timer);
				};
			}, [probeNow]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				hydrateDrawer(base, handledProbes.current).then((result) => {
					if (cancelled) return;
					setProbes(result.probes);
					setDelights(result.delights);
					setNotifications(result.notifications);
				});
				return () => {
					cancelled = true;
				};
			}, [base]);
			const [liveTick, setLiveTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const client = new LiveClient(base);
				const offEvent = client.onEvent((event) => {
					const payload = event.payload;
					if (event.type === "interest.probe" || event.type === "avoidance.probe") {
						const domain = typeof payload.domain === "string" ? payload.domain : "";
						const key = probeKey(event.type, domain);
						if (key === "" || handledProbes.current.has(key)) return;
						const probeMode = typeof payload.probe_mode === "string" ? payload.probe_mode : "";
						const challenge = probeMode === "lateral" || probeMode === "bridge" || probeMode === "wildcard";
						setProbes((prev) => {
							if (prev.some((p) => p.key === key)) return prev;
							return [...prev, {
								key,
								type: event.type === "avoidance.probe" ? "avoidance.probe" : "interest.probe",
								domain,
								reason: typeof payload.reason === "string" ? payload.reason : "",
								challenge,
								confidence: typeof payload.confidence === "number" ? payload.confidence : 0
							}];
						});
						setBadges((prev) => ({
							...prev,
							profile: (prev.profile ?? 0) + 1
						}));
						setLiveTick((tick) => tick + 1);
					} else if (event.type === "delight.candidate") {
						const bvid = typeof payload.bvid === "string" ? payload.bvid : "";
						if (bvid === "") return;
						setDelights((prev) => prev.some((d) => d.bvid === bvid) ? prev : [...prev, {
							bvid,
							title: typeof payload.title === "string" ? payload.title : "",
							reason: typeof payload.delight_reason === "string" ? payload.delight_reason : "",
							hook: typeof payload.delight_hook === "string" ? payload.delight_hook : "",
							source_platform: typeof payload.source_platform === "string" ? payload.source_platform : "bilibili",
							content_url: typeof payload.content_url === "string" ? payload.content_url : "",
							content_id: typeof payload.content_id === "string" ? payload.content_id : bvid,
							score: typeof payload.delight_score === "number" ? payload.delight_score : 0
						}]);
						setBadges((prev) => ({
							...prev,
							recommend: (prev.recommend ?? 0) + 1
						}));
						setLiveTick((tick) => tick + 1);
					} else if (event.type.startsWith("interest.") || event.type.startsWith("avoidance.")) {
						const domain = typeof payload.domain === "string" ? payload.domain : "";
						const key = probeKey(event.type, domain);
						if (key !== "") {
							handledProbes.current.add(key);
							setProbes((prev) => prev.filter((p) => p.key !== key));
						}
					} else if (event.type === "delight.liked" || event.type === "delight.disliked" || event.type === "delight.refreshed") {
						const bvid = typeof payload.bvid === "string" ? payload.bvid : "";
						if (bvid !== "") setDelights((prev) => prev.filter((d) => d.bvid !== bvid));
					}
				});
				const offStatus = client.onStatusChange(() => {
					healthProbeRef.current?.();
				});
				client.connect();
				return () => {
					offEvent();
					offStatus();
					client.dispose();
				};
			}, [base]);
			const selectTab = (0, react.useCallback)((key) => {
				setTab(key);
				setBadges((prev) => ({
					...prev,
					[key]: 0
				}));
				if (key === "recommend" || key === "profile") setLiveTick((tick) => tick + 1);
			}, []);
			const openDrawer = (0, react.useCallback)(() => {
				setDrawerOpen(true);
				setDrawerError("");
				hydrateDrawer(base, handledProbes.current).then((result) => {
					setProbes((prev) => mergeProbes(prev, result.probes));
					setDelights(result.delights);
					setNotifications(result.notifications);
				}).catch(() => void 0);
			}, [base]);
			const onProbeHandled = (0, react.useCallback)((key) => {
				handledProbes.current.add(key);
				setProbes((prev) => prev.filter((p) => p.key !== key));
			}, []);
			const onDelightHandled = (0, react.useCallback)((bvid) => {
				setDelights((prev) => prev.filter((d) => d.bvid !== bvid));
			}, []);
			const onNotificationHandled = (0, react.useCallback)((bvid) => {
				setNotifications((prev) => prev.filter((n) => n.bvid !== bvid));
			}, []);
			const messageCount = probes.length + delights.length + notifications.length;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.panel,
				"data-dark": dark,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.header,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.brand,
								children: [(0, react_jsx_runtime.jsx)("img", {
									className: panel_module_css_default.brandMark,
									src: BRAND_ICON,
									alt: "",
									"aria-hidden": "true"
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.brandCopy,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.brandTitle,
										children: "OpenBiliClaw"
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: panel_module_css_default.status,
										title: online ? "后端在线" : "后端离线",
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: panel_module_css_default.statusDot,
											"data-online": online
										}), (0, react_jsx_runtime.jsx)("span", {
											className: panel_module_css_default.statusText,
											children: online ? "后端在线" : "后端离线"
										})]
									})]
								})]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								title: "消息",
								onClick: openDrawer,
								children: [(0, react_jsx_runtime.jsx)(MessageIcon, { size: 15 }), messageCount > 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.bellBadge,
									children: messageCount > 99 ? "99+" : messageCount
								}) : null]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								title: "设置",
								onClick: () => setSettingsOpen((open) => !open),
								children: (0, react_jsx_runtime.jsx)(GearIcon, { size: 14 })
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								title: "收起侧栏",
								onClick: closeAside,
								children: (0, react_jsx_runtime.jsx)(CollapseIcon, { size: 14 })
							})
						]
					}),
					settingsOpen ? (0, react_jsx_runtime.jsx)(SettingsOverlay, {
						base,
						onBaseChange: (next) => setBase(next),
						onClose: () => setSettingsOpen(false)
					}) : null,
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.tabBar,
						children: TABS.map((item) => {
							const badgeCount = badges[item.key];
							const Icon = item.icon;
							return (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: panel_module_css_default.tab,
								"data-active": tab === item.key,
								onClick: () => selectTab(item.key),
								children: [(0, react_jsx_runtime.jsx)(Icon, { size: 15 }), (0, react_jsx_runtime.jsxs)("span", { children: [item.label, badgeCount !== void 0 && badgeCount > 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.badge,
									children: badgeCount
								}) : null] })]
							}, item.key);
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.body,
						children: [
							tab === "recommend" ? (0, react_jsx_runtime.jsx)(RecommendView, {
								base,
								refreshKey: liveTick
							}, `recommend-${base}`) : null,
							tab === "library" ? (0, react_jsx_runtime.jsx)(LibraryView, { base }, `library-${base}`) : null,
							tab === "chat" ? (0, react_jsx_runtime.jsx)(ChatView, { base }, `chat-${base}`) : null,
							tab === "profile" ? (0, react_jsx_runtime.jsx)(ProfileView, { base }, `profile-${base}-${liveTick}`) : null
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.pinnedFooter,
						children: (0, react_jsx_runtime.jsx)(ActivityFooter, { base })
					}),
					drawerOpen ? (0, react_jsx_runtime.jsx)(MessagesDrawer, {
						base,
						probes,
						delights,
						notifications,
						onClose: () => setDrawerOpen(false),
						onProbeHandled,
						onDelightHandled,
						onNotificationHandled,
						onError: setDrawerError
					}) : null,
					drawerError !== "" && drawerOpen ? (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.error,
						style: {
							position: "absolute",
							bottom: 8,
							left: 14,
							right: 14,
							zIndex: 11
						},
						children: drawerError
					}) : null
				]
			});
		}
		/** Merge persisted probes into live ones, deduped by key. */
		function mergeProbes(current, persisted) {
			const seen = /* @__PURE__ */ new Set();
			const merged = [];
			for (const p of [...persisted, ...current]) {
				if (seen.has(p.key)) continue;
				seen.add(p.key);
				merged.push(p);
			}
			return merged;
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* OpenBiliClaw DeepSeek Harness plugin — browser half.
		*
		* Occupies the layout's `aside` slot (the auxiliary rightmost column,
		* declared by @deepseek-ai/dsh-client-ui-layout) with the OpenBiliClaw
		* user-consumption sidebar: recommendations, delight cards, saved lists,
		* Socratic dialogue, profile + probes, and activity. The slot declaration is
		* injected through `ctx.slots.inject`, so activation order vs. ui-layout is
		* irrelevant and reload lifetimes are handled by the slot system.
		*
		* The panel's business face (collapse control + theme subscription) rides
		* the slot registration's `inject` factory — the inject-bearing register
		* overload — and joins the composed props as `OpenBiliClawInjected`.
		* @module @openbiliclaw/dsh-plugin
		*/
		/** Required services: the slot registry, the layout panel service, and the
		*  shell theme (the panel follows the host light/dark scheme). */
		const inject = [
			"slots",
			"layout",
			"theme"
		];
		/**
		* Client plugin body: register the panel into the layout's `aside` slot.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const injected = {
				closeAside: () => {
					ctx.layout.closeAside();
				},
				isDark: () => ctx.theme.getTheme().active.colorScheme === "dark",
				onThemeChange: (listener) => ctx.on("theme/change", (snapshot) => {
					listener(snapshot.active.colorScheme === "dark");
				})
			};
			ctx.effect(() => ctx.slots.inject("aside", () => ctx.slots.register({
				name: "aside",
				inject: () => injected
			}, function OpenBiliClawAside(props) {
				return (0, react.createElement)(OpenBiliClawPanel, injected);
			})), "openbiliclaw: aside panel");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map