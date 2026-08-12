/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * Occupies the layout's `aside` slot (the auxiliary rightmost column,
 * declared by @deepseek-ai/dsh-client-ui-layout) with the OpenBiliClaw
 * user-consumption sidebar: recommendations, delight cards, saved lists,
 * Socratic dialogue, profile + probes, and activity. The slot declaration is
 * injected through `ctx.slots.inject`, so activation order vs. ui-layout is
 * irrelevant and reload lifetimes are handled by the slot system.
 * @module @openbiliclaw/dsh-plugin
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx';
/** Required services: the slot registry, the layout panel service, and the
 *  shell theme (the panel follows the host light/dark scheme). */
export declare const inject: string[];
/**
 * Client plugin body: register the panel into the layout's `aside` slot.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map