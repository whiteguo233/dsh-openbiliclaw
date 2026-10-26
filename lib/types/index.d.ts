import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { type BridgeConfig } from './bridge.ts';
/** Plugin id for loader rows. */
export declare const name = "openbiliclaw";
/** Required services: the tool registry and the skill registry. The web server
 *  is optional — headless profiles have none, and only the browser half's
 *  bootstrap route needs it. */
export declare const inject: string[];
/** Host route the browser half reads its initial backend address from. */
export declare const CONNECTION_ROUTE = "/openbiliclaw/connection";
/** Raw row config (no schema — every field defaults in code). */
export interface OpenBiliClawRowConfig {
    apiUrl?: string;
    workdir?: string;
    skillPath?: string;
    timeoutMs?: number;
}
/**
 * Answer the browser half's bootstrap request with the resolved backend
 * address. GET/HEAD only; no secrets are exposed (the address is already
 * visible to anyone who can reach the panel).
 * @param config - the resolved bridge config.
 * @param req - incoming request.
 * @param res - response to complete.
 */
export declare function serveConnection(config: BridgeConfig, req: IncomingMessage, res: ServerResponse): void;
/**
 * Plugin body: wire the bridge tools, the adapter skill, and the browser
 * bootstrap route.
 * @param ctx - plugin context.
 * @param config - raw row config (optional; defaults apply).
 */
export declare function apply(ctx: Context, config?: OpenBiliClawRowConfig): void;
//# sourceMappingURL=index.d.ts.map