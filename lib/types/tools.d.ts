import type { Bridge } from './bridge.ts';
/**
 * Split a platform-prefixed item key into its platform and bare content id.
 * Content ids may themselves contain colons (`github:repository:946380199`),
 * so only the first segment is treated as the platform. Values without a
 * recognized platform prefix (a bare bvid, a numeric id) return null.
 * @param itemKey - a card's `item_key`, or a bare content id.
 * @returns the split identity, or null when the value carries no prefix.
 */
export declare function splitItemKey(itemKey: string): {
    sourcePlatform: string;
    contentId: string;
} | null;
/**
 * Resolve the `save-local` argv identity. The bridge CLI takes a bare
 * `--content-id` and composes the item key itself (`<platform>:<content-id>`),
 * so a full `item_key` must be split — otherwise the stored key ends up
 * double-prefixed (`bilibili:bilibili:BV...`) and no longer matches the card.
 * @param itemKey - full item key or bare content id from the caller.
 * @param sourcePlatform - explicit platform, when the caller named one.
 * @returns the platform and content id to send to the CLI.
 */
export declare function resolveSaveTarget(itemKey: string, sourcePlatform: string | undefined): {
    sourcePlatform: string;
    contentId: string;
};
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