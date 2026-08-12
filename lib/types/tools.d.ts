import type { Bridge } from './bridge.ts';
/**
 * Register every bridge tool on ctx.tools.
 * @param ctx - plugin context with the tools registry.
 * @param bridge - the resolved bridge face.
 * @returns array of tool disposers (for effect wiring).
 */
export declare function registerBridgeTools(ctx: {
    tools: {
        register(def: unknown): () => void;
    };
}, bridge: Bridge): Array<() => void>;
//# sourceMappingURL=tools.d.ts.map