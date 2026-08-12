import type { Context } from 'cordis';
/** Plugin id for loader rows. */
export declare const name = "openbiliclaw";
/** Required services: the tool registry, the skill registry, and bash. */
export declare const inject: string[];
/** Raw row config (no schema — every field defaults in code). */
export interface OpenBiliClawRowConfig {
    pythonBin?: string;
    workdir?: string;
    skillPath?: string;
    timeoutMs?: number;
    stdoutMaxBytes?: number;
}
/**
 * Plugin body: wire the bridge tools and the adapter skill.
 * @param ctx - plugin context.
 * @param config - raw row config (optional; defaults apply).
 */
export declare function apply(ctx: Context, config?: OpenBiliClawRowConfig): void;
//# sourceMappingURL=index.d.ts.map