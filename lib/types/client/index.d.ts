/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The panel no longer occupies the layout's `aside` column (removed in current
 * DSH). Instead it mounts on two additive root-scoped seats:
 *   - `sidebar.footer.action` — the left-sidebar trigger button beside
 *     Settings, which toggles the drawer open/closed;
 *   - `shell.overlay` — the frame-wide floating layer, where the panel renders
 *     as a right-side drawer sliding over every column (so it never competes
 *     with the details / files / changes panel).
 *
 * Both seats share one drawer store handle built in `apply`, so the button and
 * the drawer read/write the same open/closed cell. Registrations ride
 * `ctx.slots.inject`, so activation order vs. ui-sidebar / ui-layout is
 * irrelevant and reload lifetimes are handled by the slot system. The panel's
 * business face (theme subscription + close) rides the overlay registration's
 * `inject` factory — the inject-bearing register overload — and joins the
 * composed props as `OpenBiliClawInjected`.
 * @module @openbiliclaw/dsh-plugin
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx';
/** Required services: the slot registry and the shell theme (the panel follows
 *  the host light/dark scheme). */
export declare const inject: string[];
/**
 * Client plugin body: register the sidebar trigger button and the floating
 * right drawer, both bound to the same shared drawer store.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map