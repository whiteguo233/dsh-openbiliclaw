import type { Context } from '@deepseek-ai/cordis';
/** Plugin id for loader rows. */
export declare const name = "openbiliclaw";
/** Required services: the tool registry, the skill registry, and the shell
 *  executor (the renamed `bash` seam in newer DSH snapshots). */
export declare const inject: string[];
/** Raw row config (no schema — every field defaults in code). */
export interface OpenBiliClawRowConfig {
    apiUrl?: string;
    workdir?: string;
    skillPath?: string;
    timeoutMs?: number;
}
/**
 * Plugin body: wire the bridge tools and the adapter skill.
 * @param ctx - plugin context.
 * @param config - raw row config (optional; defaults apply).
 */
export declare function apply(ctx: Context, config?: OpenBiliClawRowConfig): void;
//# sourceMappingURL=index.d.ts.map