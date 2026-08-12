/**
 * Agent-bridge CLI invocation through the harness bash service. Every tool
 * shells out to `python -m openbiliclaw.integrations.openclaw.cli` (the
 * host-neutral agent-bridge/v2 JSON contract OpenClaw/Hermes/WorkBuddy share),
 * parses the JSON line, and turns `{"ok": false, ...}` payloads into thrown
 * errors — the skill's working rules: parse JSON, surface errors, stop.
 * @module @openbiliclaw/dsh-plugin
 */
import type { BashExecRequest, BashRunResult } from '@deepseek-ai/dsh-bash';
import type { JsonValue } from '@deepseek-ai/dsh-session';
/** Resolved plugin config (defaults applied in the plugin entry). */
export interface BridgeConfig {
    /** Python interpreter of the OpenBiliClaw environment. */
    pythonBin: string;
    /** OpenBiliClaw checkout directory (config.toml + data/ live here). */
    workdir: string;
    /** Absolute path of the adapter SKILL.md, or '' to skip registration. */
    skillPath: string;
    /** Per-command budget in ms. */
    timeoutMs: number;
    /** Max stdout bytes captured per command. */
    stdoutMaxBytes: number;
}
/** The bridge service face the tools need (narrowed bash + config). */
export interface Bridge {
    readonly config: BridgeConfig;
    /** Run one bridge command with CLI-style argv; returns the parsed `data` payload as lossless JSON. */
    run(command: string, args: readonly string[]): Promise<JsonValue>;
}
/** A successful bridge reply: `{"ok": true, "data": ...}`. */
export interface BridgeOk {
    ok: true;
    data: unknown;
}
/** A failed bridge reply: `{"ok": false, ...}`. */
export interface BridgeError {
    ok: false;
    error?: string;
    message?: string;
    [key: string]: unknown;
}
/** Parse the bridge CLI's single JSON line from captured stdout. */
export declare function parseBridgeLine(stdout: string): BridgeOk | BridgeError;
/**
 * Build the bridge face over the harness bash service. Commands run with the
 * checkout as workdir so `config.toml` / `data/` resolve exactly like the
 * running backend's; the default pythonBin is that checkout's `.venv`.
 * @param bash - the harness bash service (ctx.bash).
 * @param config - resolved plugin config.
 * @returns the bridge face.
 */
export declare function createBridge(bash: {
    resolve(request: BashExecRequest): unknown;
    run(spec: unknown): Promise<BashRunResult>;
}, config: BridgeConfig): Bridge;
//# sourceMappingURL=bridge.d.ts.map