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
 * The row config is the single source of truth for the backend address. The
 * tools use it directly; the browser half reads it back from
 * {@link CONNECTION_ROUTE} on first load, so the panel and the tools target
 * the same backend instead of the panel silently falling back to its built-in
 * default. An address saved in the panel's own settings still wins.
 *
 * Config (row config in cordis.patch.yml; all optional):
 *   apiUrl         OpenBiliClaw serve-api base URL (default: http://127.0.0.1:8420)
 *   workdir        OpenBiliClaw checkout dir (config.toml + data live here; default: /Users/white/workspace/OpenBiliClaw)
 *   skillPath      adapter SKILL.md path (default: <workdir>/skills/openbiliclaw-adapter/SKILL.md)
 *   timeoutMs      per-command budget in ms (default 300000)
 * @module @openbiliclaw/dsh-plugin
 */
import { readFileSync } from 'node:fs';
import { createBridge } from "./bridge.js";
import { registerBridgeTools } from "./tools.js";
import { loadAdapterSkill } from "./skill.js";
/** Plugin id for loader rows. */
export const name = 'openbiliclaw';
/** Required services: the tool registry and the skill registry. The web server
 *  is optional — headless profiles have none, and only the browser half's
 *  bootstrap route needs it. */
export const inject = ['tools', 'skills'];
/** Host route the browser half reads its initial backend address from. */
export const CONNECTION_ROUTE = '/openbiliclaw/connection';
const DEFAULT_WORKDIR = '/Users/white/workspace/OpenBiliClaw';
/** Apply config defaults and normalize paths. */
function resolveConfig(config) {
    const workdir = config?.workdir?.trim() !== '' && config?.workdir !== undefined
        ? config.workdir
        : DEFAULT_WORKDIR;
    return {
        apiUrl: config?.apiUrl?.trim() !== '' && config?.apiUrl !== undefined
            ? config.apiUrl
            : 'http://127.0.0.1:8420',
        workdir,
        skillPath: config?.skillPath?.trim() !== '' && config?.skillPath !== undefined
            ? config.skillPath
            : `${workdir}/skills/openbiliclaw-adapter/SKILL.md`,
        timeoutMs: typeof config?.timeoutMs === 'number' && config.timeoutMs > 0 ? config.timeoutMs : 300_000,
    };
}
/**
 * Answer the browser half's bootstrap request with the resolved backend
 * address. GET/HEAD only; no secrets are exposed (the address is already
 * visible to anyone who can reach the panel).
 * @param config - the resolved bridge config.
 * @param req - incoming request.
 * @param res - response to complete.
 */
export function serveConnection(config, req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('allow', 'GET, HEAD');
        res.end();
        return;
    }
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ apiUrl: config.apiUrl, version: 1 }));
}
/**
 * Plugin body: wire the bridge tools, the adapter skill, and the browser
 * bootstrap route.
 * @param ctx - plugin context.
 * @param config - raw row config (optional; defaults apply).
 */
export function apply(ctx, config) {
    const resolved = resolveConfig(config);
    const bridge = createBridge(resolved);
    const logger = ctx.logger('openbiliclaw');
    ctx.effect(() => registerBridgeTools(ctx, bridge), 'openbiliclaw: bridge tools');
    // The adapter skill is read synchronously at activation: the file lives in
    // the checkout and is the canonical contract the bridge tools implement.
    let skillText = null;
    try {
        skillText = readFileSync(resolved.skillPath, 'utf8');
    }
    catch {
        logger.warn('adapter SKILL.md not found at %s — skill registration skipped', resolved.skillPath);
    }
    if (skillText !== null) {
        const skill = loadAdapterSkill(skillText, resolved.skillPath);
        ctx.effect(() => ctx.skills.register(skill), 'openbiliclaw: adapter skill');
    }
    // Browser half bootstrap. `inject` keeps this inert on headless profiles,
    // where no web server ever appears; the tools above stay available there.
    ctx.inject(['webServer'], (web) => {
        web.effect(() => web.webServer.register({
            kind: 'exact',
            path: CONNECTION_ROUTE,
            handler: (req, res) => { serveConnection(resolved, req, res); },
        }), 'openbiliclaw: browser bootstrap route');
    });
}
//# sourceMappingURL=index.js.map