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
import { readFileSync } from 'node:fs';
import { createBridge } from "./bridge.js";
import { registerBridgeTools } from "./tools.js";
import { loadAdapterSkill } from "./skill.js";
/** Plugin id for loader rows. */
export const name = 'openbiliclaw';
/** Required services: the tool registry, the skill registry, and the shell
 *  executor (the renamed `bash` seam in newer DSH snapshots). */
export const inject = ['tools', 'skills', 'shell'];
const DEFAULT_WORKDIR = '/Users/white/workspace/OpenBiliClaw';
/** Apply config defaults and normalize paths. */
function resolveConfig(config) {
    const workdir = config?.workdir?.trim() !== '' && config?.workdir !== undefined
        ? config.workdir
        : DEFAULT_WORKDIR;
    return {
        pythonBin: config?.pythonBin?.trim() !== '' && config?.pythonBin !== undefined
            ? config.pythonBin
            : `${workdir}/.venv/bin/python`,
        workdir,
        skillPath: config?.skillPath?.trim() !== '' && config?.skillPath !== undefined
            ? config.skillPath
            : `${workdir}/skills/openbiliclaw-adapter/SKILL.md`,
        timeoutMs: typeof config?.timeoutMs === 'number' && config.timeoutMs > 0 ? config.timeoutMs : 300_000,
        stdoutMaxBytes: typeof config?.stdoutMaxBytes === 'number' && config.stdoutMaxBytes > 0 ? config.stdoutMaxBytes : 2_000_000,
    };
}
/**
 * Plugin body: wire the bridge tools and the adapter skill.
 * @param ctx - plugin context.
 * @param config - raw row config (optional; defaults apply).
 */
export function apply(ctx, config) {
    const resolved = resolveConfig(config);
    const bridge = createBridge(ctx.shell, resolved);
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
}
//# sourceMappingURL=index.js.map