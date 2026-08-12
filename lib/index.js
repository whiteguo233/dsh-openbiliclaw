import { readFileSync } from "node:fs";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/bridge.js
/** Parse the bridge CLI's single JSON line from captured stdout. */
function parseBridgeLine(stdout) {
	const trimmed = stdout.trim();
	if (trimmed === "") throw new Error("openbiliclaw bridge: empty output");
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error(`openbiliclaw bridge: non-JSON output: ${trimmed.slice(0, 400)}`);
	}
	if (typeof parsed !== "object" || parsed === null) throw new Error(`openbiliclaw bridge: unexpected payload shape: ${trimmed.slice(0, 400)}`);
	const reply = parsed;
	if (reply.ok !== true) {
		const err = reply;
		throw new Error(`openbiliclaw bridge error: ${String(err.error ?? err.message ?? "unknown")}`);
	}
	return {
		ok: true,
		data: reply.data
	};
}
/**
* Build the bridge face over the harness bash service. Commands run with the
* checkout as workdir so `config.toml` / `data/` resolve exactly like the
* running backend's; the default pythonBin is that checkout's `.venv`.
* @param bash - the harness bash service (ctx.bash).
* @param config - resolved plugin config.
* @returns the bridge face.
*/
function createBridge(bash, config) {
	return {
		config,
		async run(command, args) {
			const argv = [
				config.pythonBin,
				"-m",
				"openbiliclaw.integrations.openclaw.cli",
				command,
				...args
			];
			const spec = bash.resolve({
				command: argv.map(shellQuote).join(" "),
				workdir: config.workdir,
				timeoutMs: config.timeoutMs,
				stdoutMaxBytes: config.stdoutMaxBytes,
				sandboxPolicy: {
					mode: "workspace-write",
					workspaceRoot: config.workdir
				}
			});
			const result = await bash.run(spec);
			const stdout = result.stdout.text;
			if (result.exitCode !== 0) {
				const stderr = result.stderr.text.trim();
				const tail = stderr.length > 1500 ? stderr.slice(stderr.length - 1500) : stderr;
				throw new Error(`openbiliclaw bridge exited ${String(result.exitCode)}: ${tail || stdout.slice(-1500)}`);
			}
			return parseBridgeLine(stdout).data;
		}
	};
}
/** Single-quote a shell argument (argv is built for one bash command line). */
function shellQuote(value) {
	if (/^[A-Za-z0-9_./:=,@%+^~-]+$/.test(value)) return value;
	return `'${value.replace(/'/g, `'\\''`)}'`;
}
//#endregion
//#region lib/types/tools.js
/**
* Agent-bridge tool set: one DSH tool per OpenBiliClaw capability, mirroring
* the openbiliclaw-adapter skill names so the agent can operate the
* consumption loop (recommend → delight → probes → chat → save → feedback)
* without raw shell access. Durable write tools (feedback, delight respond,
* probes respond) REQUIRE the caller to supply a stable `requestId` and reuse
* it for retries of the same action — never across different actions.
* @module @openbiliclaw/dsh-plugin
*/
/** Plain-text output: the canonical JSON value renders as its text form. */
const TEXT_OUTPUT = {
	schema: { type: "json" },
	render: (_args, value) => [{
		type: "text",
		text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
	}]
};
/** Simple string parameter helper (required keys annotated, optional keys omitted). */
function str(description, required = false) {
	return required ? {
		type: "string",
		required: true,
		description
	} : {
		type: "string",
		description
	};
}
/** Simple integer parameter helper. */
function int(description, required = false) {
	return required ? {
		type: "integer",
		required: true,
		description
	} : {
		type: "integer",
		description
	};
}
/** Simple boolean parameter helper. */
function bool(description, required = false) {
	return required ? {
		type: "boolean",
		required: true,
		description
	} : {
		type: "boolean",
		description
	};
}
/** Reject empty-string params that a CLI flag would otherwise swallow. */
function nonEmpty(value, label) {
	const text = typeof value === "string" ? value.trim() : "";
	if (text === "") throw new Error(`openbiliclaw: ${label} is required`);
	return text;
}
/**
* Register every bridge tool on ctx.tools.
* @param ctx - plugin context with the tools registry.
* @param bridge - the resolved bridge face.
* @returns array of tool disposers (for effect wiring).
*/
function registerBridgeTools(ctx, bridge) {
	const register = (definition) => ctx.tools.register(definition);
	return [
		register(defineTool({
			name: "openbiliclaw_get_capabilities",
			description: "Negotiate the OpenBiliClaw agent bridge: protocol version, adapter version and the authoritative skill name list. Run this first when the backend may have upgraded.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("capabilities", [])
		})),
		register(defineTool({
			name: "openbiliclaw_recommend",
			description: "Fetch a page of multi-source content recommendations (fast path; does not trigger a runtime refresh unless requested). Returns cards with item_key/content_id/source_platform plus bvid/up_name compatibility fields.",
			parameters: {
				limit: int("How many recommendations to return (default 5).", false),
				sourcePlatform: str("Optional canonical platform scope: bilibili, xiaohongshu, douyin, youtube, x (twitter), zhihu, weibo, reddit, linuxdo, v2ex. Empty = all platforms.", false),
				excludeItemId: str("Optional item_key (or bvid) to exclude from this page.", false),
				refreshIfNeeded: bool("When true, run a heavier freshness check before the recommendation fetch. Only use when the user explicitly wants it.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [];
				const limit = typeof args.limit === "number" ? args.limit : 5;
				argv.push("--limit", String(Math.max(1, Math.min(50, Math.floor(limit)))));
				if (typeof args.sourcePlatform === "string" && args.sourcePlatform.trim() !== "") argv.push("--source-platform", args.sourcePlatform.trim());
				if (typeof args.excludeItemId === "string" && args.excludeItemId.trim() !== "") argv.push("--exclude-item-id", args.excludeItemId.trim());
				if (args.refreshIfNeeded === true) argv.push("--refresh-if-needed");
				return bridge.run("recommend", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_reshuffle",
			description: "Replace the current recommendation page with a fresh one (same pool, new draw). Optional platform scope and visible-card exclusions.",
			parameters: {
				sourcePlatform: str("Optional canonical platform scope (bilibili, xiaohongshu, ...). Empty = all.", false),
				excludedBvids: str("Optional comma-separated item_keys/bvids to exclude from the new page.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [];
				if (typeof args.sourcePlatform === "string" && args.sourcePlatform.trim() !== "") argv.push("--source-platform", args.sourcePlatform.trim());
				if (typeof args.excludedBvids === "string" && args.excludedBvids.trim() !== "") for (const id of args.excludedBvids.split(",").map((s) => s.trim()).filter(Boolean)) argv.push("--exclude-item-id", id);
				return bridge.run("reshuffle", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_append_recommendations",
			description: "Append another recommendation page after the current one (scroll-to-load pattern).",
			parameters: {
				limit: int("How many recommendations to append (default 5).", false),
				sourcePlatform: str("Optional canonical platform scope. Empty = all.", false),
				excludedBvids: str("Optional comma-separated item_keys/bvids to exclude.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [];
				const limit = typeof args.limit === "number" ? args.limit : 5;
				argv.push("--limit", String(Math.max(1, Math.min(50, Math.floor(limit)))));
				if (typeof args.sourcePlatform === "string" && args.sourcePlatform.trim() !== "") argv.push("--source-platform", args.sourcePlatform.trim());
				if (typeof args.excludedBvids === "string" && args.excludedBvids.trim() !== "") for (const id of args.excludedBvids.split(",").map((s) => s.trim()).filter(Boolean)) argv.push("--exclude-item-id", id);
				return bridge.run("append", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_submit_feedback",
			description: "Submit explicit feedback on one recommendation card (like/dislike/comment/dismiss/...). REQUIRES a stable requestId: reuse it only when retrying this exact same action; never reuse it for a different recommendation, type or note. For comment feedback always include a note.",
			parameters: {
				recommendationId: int("The recommendation card id (the `id` field of the recommendation item).", true),
				feedbackType: str("Feedback kind, e.g. like, dislike, comment, dismiss.", true),
				requestId: str("Stable idempotency key for THIS action (max 400 chars). Reuse on retries of the same action only.", true),
				note: str("Optional note; required for comment feedback.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const recommendationId = typeof args.recommendationId === "number" ? Math.floor(args.recommendationId) : NaN;
				if (!Number.isFinite(recommendationId)) throw new Error("openbiliclaw: recommendationId is required");
				const feedbackType = nonEmpty(args.feedbackType, "feedbackType");
				const requestId = nonEmpty(args.requestId, "requestId");
				const argv = [
					"--recommendation-id",
					String(recommendationId),
					"--feedback-type",
					feedbackType,
					"--request-id",
					requestId
				];
				if (typeof args.note === "string" && args.note.trim() !== "") argv.push("--note", args.note.trim());
				return bridge.run("submit-feedback", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_get_delight",
			description: "Fetch the current proactive surprise-recommendation card (delight candidate) with its delight_reason, delight_score and delight_hook, or null when none is pending.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("get-delight", [])
		})),
		register(defineTool({
			name: "openbiliclaw_respond_delight",
			description: "React to a proactive delight (surprise recommendation) card: view, like, dislike, dismiss or chat. dismiss permanently removes the item from future recommendations (also removes it from regular recommendations); view only marks it seen. REQUIRES a stable requestId reused only for retries of the same action.",
			parameters: {
				bvid: str("The card bvid (or item_key/content_id when bvid is empty).", true),
				response: str("One of: view, like, dislike, dismiss, chat.", true),
				requestId: str("Stable idempotency key for THIS action (max 400 chars).", true),
				title: str("Optional card title.", false),
				message: str("Message when response is chat.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [
					"--bvid",
					nonEmpty(args.bvid, "bvid"),
					"--response",
					nonEmpty(args.response, "response"),
					"--request-id",
					nonEmpty(args.requestId, "requestId")
				];
				if (typeof args.title === "string" && args.title.trim() !== "") argv.push("--title", args.title.trim());
				if (typeof args.message === "string" && args.message.trim() !== "") argv.push("--message", args.message.trim());
				return bridge.run("respond-delight", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_get_runtime_status",
			description: "OpenBiliClaw runtime summary: initialized, recommendation count, pool availability, unread count, LLM concurrency, last refresh. Use it to check whether the backend is ready before other calls.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("runtime-status", [])
		})),
		register(defineTool({
			name: "openbiliclaw_get_activity_feed",
			description: "Recent OpenBiliClaw activity feed (profile updates, delight generation, probes, saves).",
			parameters: { limit: int("How many feed entries (default 10).", false) },
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: async (args) => {
				const limit = typeof args.limit === "number" ? args.limit : 10;
				return bridge.run("activity-feed", ["--limit", String(Math.max(1, Math.min(100, Math.floor(limit))))]);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_get_platform_availability",
			description: "Servable candidate inventory split by source platform: how many more recommendations each platform can still serve.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("platform-availability", [])
		})),
		register(defineTool({
			name: "openbiliclaw_chat",
			description: "Send one Socratic dialogue turn to the OpenBiliClaw soul engine. The reply probes deeper and the exchange feeds back into the user profile. The user's answers here are how the system refines interests/avoidances.",
			parameters: {
				message: str("The message to send (user's words, relayed verbatim).", true),
				session: str("Dialogue session name (default openbiliclaw).", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = ["--message", nonEmpty(args.message, "message")];
				if (typeof args.session === "string" && args.session.trim() !== "") argv.push("--session", args.session.trim());
				return bridge.run("chat", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_get_chat_history",
			description: "Read the durable Socratic dialogue history for a session.",
			parameters: {
				session: str("Dialogue session name (default openbiliclaw).", false),
				limit: int("How many turns to read (default 50).", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: async (args) => {
				const argv = [];
				if (typeof args.session === "string" && args.session.trim() !== "") argv.push("--session", args.session.trim());
				const limit = typeof args.limit === "number" ? args.limit : 50;
				argv.push("--limit", String(Math.max(1, Math.min(200, Math.floor(limit)))));
				return bridge.run("chat-history", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_next_probe",
			description: "Get the next speculative interest hypothesis to ask the user about: a ready-to-ask question plus domain/reason/specifics/confidence, or null when nothing is pending. Ask the user the question, then relay their answer with respond_interest_probe.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("next-probe", [])
		})),
		register(defineTool({
			name: "openbiliclaw_respond_interest_probe",
			description: "Answer a speculative interest probe: confirm (promote it), reject (30-day cooldown), defer (snooze), or chat (forward to the dialogue engine and return its reply).",
			parameters: {
				domain: str("The probe domain, exactly as returned by next_probe.", true),
				response: str("One of: confirm, reject, defer, chat.", true),
				message: str("Optional message (used with chat).", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [
					"--domain",
					nonEmpty(args.domain, "domain"),
					"--response",
					nonEmpty(args.response, "response")
				];
				if (typeof args.message === "string" && args.message.trim() !== "") argv.push("--message", args.message.trim());
				return bridge.run("respond-interest-probe", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_next_avoidance_probe",
			description: "Get the next speculative avoidance hypothesis to ask the user about, or null when nothing is pending.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("next-avoidance-probe", [])
		})),
		register(defineTool({
			name: "openbiliclaw_respond_avoidance_probe",
			description: "Answer a speculative avoidance probe: confirm (register the avoidance), reject, defer (snooze), or chat (forward to the dialogue engine).",
			parameters: {
				domain: str("The probe domain, exactly as returned by next_avoidance_probe.", true),
				response: str("One of: confirm, reject, defer, chat.", true),
				message: str("Optional message (used with chat).", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [
					"--domain",
					nonEmpty(args.domain, "domain"),
					"--response",
					nonEmpty(args.response, "response")
				];
				if (typeof args.message === "string" && args.message.trim() !== "") argv.push("--message", args.message.trim());
				return bridge.run("respond-avoidance-probe", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_get_profile",
			description: "The current OpenBiliClaw user profile summary (interests, avoidances, traits). Use it to understand what the user likes before recommending or chatting.",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("get-profile", [])
		})),
		register(defineTool({
			name: "openbiliclaw_get_profile_edit_state",
			description: "The full overlay edit state of the user profile (what the system believes vs. what the user has explicitly confirmed/edited).",
			parameters: {},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: () => bridge.run("profile-edit-state", [])
		})),
		register(defineTool({
			name: "openbiliclaw_edit_profile",
			description: "Apply one deterministic profile overlay edit. target is an onion field path (e.g. core.core_traits) or an interest polarity (likes/dislikes); op is set/add/remove/reset; parent targets a specific interest domain under likes/dislikes; weight pins a domain weight.",
			parameters: {
				target: str("Field path or polarity (e.g. core.core_traits, likes, dislikes).", true),
				op: str("One of: set, add, remove, reset.", true),
				value: str("Value for set/add (string form; numbers pass through).", false),
				parent: str("Specific interest domain when target is likes/dislikes.", false),
				weight: str("Optional weight (number as string) when pinning a domain.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const argv = [
					"--target",
					nonEmpty(args.target, "target"),
					"--op",
					nonEmpty(args.op, "op")
				];
				if (typeof args.value === "string" && args.value.trim() !== "") argv.push("--value", args.value.trim());
				if (typeof args.parent === "string" && args.parent.trim() !== "") argv.push("--parent", args.parent.trim());
				if (typeof args.weight === "string" && args.weight.trim() !== "") argv.push("--weight", args.weight.trim());
				return bridge.run("edit-profile", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_save_local",
			description: "Save a content item to the local favorite or watch_later list (local SQLite only; never syncs to external accounts). Use only when the user asked to save or bookmark an item.",
			parameters: {
				listKind: str("Which list: favorite or watch_later.", true),
				itemKey: str("The item identity (content_id / item_key / bvid).", true),
				sourcePlatform: str("Canonical platform (bilibili, xiaohongshu, ...). Default bilibili.", false),
				title: str("Optional title.", false),
				contentUrl: str("Optional canonical content URL.", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const listKind = nonEmpty(args.listKind, "listKind");
				const itemKey = nonEmpty(args.itemKey, "itemKey");
				const argv = [
					"--list-kind",
					listKind,
					"--source-platform",
					typeof args.sourcePlatform === "string" && args.sourcePlatform.trim() !== "" ? args.sourcePlatform.trim() : "bilibili",
					"--content-id",
					itemKey
				];
				if (typeof args.title === "string" && args.title.trim() !== "") argv.push("--title", args.title.trim());
				if (typeof args.contentUrl === "string" && args.contentUrl.trim() !== "") argv.push("--content-url", args.contentUrl.trim());
				return bridge.run("save-local", argv);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_remove_saved",
			description: "Remove one item from the local favorite or watch_later list.",
			parameters: {
				listKind: str("Which list: favorite or watch_later.", true),
				itemKey: str("The item identity (content_id / item_key / bvid).", true)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			execute: async (args) => {
				const listKind = nonEmpty(args.listKind, "listKind");
				const itemKey = nonEmpty(args.itemKey, "itemKey");
				return bridge.run("remove-saved", [
					"--list-kind",
					listKind,
					"--item-key",
					itemKey
				]);
			}
		})),
		register(defineTool({
			name: "openbiliclaw_list_saved",
			description: "List the local favorite or watch_later items.",
			parameters: {
				listKind: str("Which list: favorite or watch_later.", true),
				limit: int("How many items (default 50).", false)
			},
			output: TEXT_OUTPUT,
			timeoutMs: bridge.config.timeoutMs,
			isConcurrencySafe: () => true,
			execute: async (args) => {
				const listKind = nonEmpty(args.listKind, "listKind");
				const limit = typeof args.limit === "number" ? args.limit : 50;
				return bridge.run("list-saved", [
					"--list-kind",
					listKind,
					"--limit",
					String(Math.max(1, Math.min(200, Math.floor(limit))))
				]);
			}
		}))
	];
}
//#endregion
//#region lib/types/skill.js
/**
* Parse a SKILL.md frontmatter block (`---` delimited YAML-lite: `key: value`
* lines). The repo skill uses flat scalar fields only.
* @param raw - the full SKILL.md text.
* @returns frontmatter and body.
*/
function parseSkillFrontmatter(raw) {
	const meta = {};
	const trimmed = raw.replace(/^\uFEFF/, "");
	if (!trimmed.startsWith("---")) return {
		meta,
		body: trimmed
	};
	const end = trimmed.indexOf("\n---", 3);
	if (end < 0) return {
		meta,
		body: trimmed
	};
	const head = trimmed.slice(3, end);
	const body = trimmed.slice(end + 4).replace(/^\n+/, "");
	for (const line of head.split("\n")) {
		const idx = line.indexOf(":");
		if (idx <= 0) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
		if (key !== "") meta[key] = value;
	}
	return {
		meta,
		body
	};
}
/**
* Build the skill registration from the adapter SKILL.md text.
* @param raw - the SKILL.md text (frontmatter + body).
* @param skillPath - absolute path of the file (surfaced to consumers).
* @returns the registration.
*/
function loadAdapterSkill(raw, skillPath) {
	const { meta, body } = parseSkillFrontmatter(raw);
	return {
		name: meta.name ?? "openbiliclaw_adapter",
		description: meta.description ?? "Use OpenBiliClaw's versioned Agent Bridge to read multi-source recommendations, profile state, dialogue, probes, saved lists, and submit explicit feedback.",
		content: body.trim(),
		path: skillPath,
		source: "runtime",
		invocation: {
			modelInvocable: true,
			userInvocable: true
		},
		provider: "openbiliclaw",
		...meta.whenToUse !== void 0 && meta.whenToUse !== "" ? { whenToUse: meta.whenToUse } : {}
	};
}
//#endregion
//#region lib/types/index.js
/**
* OpenBiliClaw DeepSeek Harness plugin — node half.
*
* Registers the agent-bridge tool set (recommend / delight / probes / chat /
* profile / saved / feedback — the user-consumption loop) and the canonical
* openbiliclaw-adapter skill, so the DSH agent can operate a running
* OpenBiliClaw backend in a closed loop. Crawling/source-management features
* are intentionally NOT exposed: the bridge's sync-account / sync-saved
* commands are absent here.
*
* Config (row config in cordis.patch.yml; all optional):
*   pythonBin      python interpreter of the OpenBiliClaw env (default: <workdir>/.venv/bin/python)
*   workdir        OpenBiliClaw checkout dir (config.toml + data live here; default: /Users/white/workspace/OpenBiliClaw)
*   skillPath      adapter SKILL.md path (default: <workdir>/skills/openbiliclaw-adapter/SKILL.md)
*   timeoutMs      per-command budget in ms (default 300000)
*   stdoutMaxBytes captured stdout cap (default 2 MB)
* @module @openbiliclaw/dsh-plugin
*/
/** Plugin id for loader rows. */
const name = "openbiliclaw";
/** Required services: the tool registry, the skill registry, and bash. */
const inject = [
	"tools",
	"skills",
	"bash"
];
const DEFAULT_WORKDIR = "/Users/white/workspace/OpenBiliClaw";
/** Apply config defaults and normalize paths. */
function resolveConfig(config) {
	const workdir = config?.workdir?.trim() !== "" && config?.workdir !== void 0 ? config.workdir : DEFAULT_WORKDIR;
	return {
		pythonBin: config?.pythonBin?.trim() !== "" && config?.pythonBin !== void 0 ? config.pythonBin : `${workdir}/.venv/bin/python`,
		workdir,
		skillPath: config?.skillPath?.trim() !== "" && config?.skillPath !== void 0 ? config.skillPath : `${workdir}/skills/openbiliclaw-adapter/SKILL.md`,
		timeoutMs: typeof config?.timeoutMs === "number" && config.timeoutMs > 0 ? config.timeoutMs : 3e5,
		stdoutMaxBytes: typeof config?.stdoutMaxBytes === "number" && config.stdoutMaxBytes > 0 ? config.stdoutMaxBytes : 2e6
	};
}
/**
* Plugin body: wire the bridge tools and the adapter skill.
* @param ctx - plugin context.
* @param config - raw row config (optional; defaults apply).
*/
function apply(ctx, config) {
	const resolved = resolveConfig(config);
	const bridge = createBridge(ctx.bash, resolved);
	const logger = ctx.logger("openbiliclaw");
	ctx.effect(() => registerBridgeTools(ctx, bridge), "openbiliclaw: bridge tools");
	let skillText = null;
	try {
		skillText = readFileSync(resolved.skillPath, "utf8");
	} catch {
		logger.warn("adapter SKILL.md not found at %s — skill registration skipped", resolved.skillPath);
	}
	if (skillText !== null) {
		const skill = loadAdapterSkill(skillText, resolved.skillPath);
		ctx.effect(() => ctx.skills.register(skill), "openbiliclaw: adapter skill");
	}
}
//#endregion
export { apply, inject, name };
