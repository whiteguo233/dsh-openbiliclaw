/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The official DSH layout has no root-scoped `aside` slot and `ctx.layout` has
 * no aside verbs, so the panel cannot claim a column through the slot system.
 * Instead a `PanelLayoutController` reserves a strip with the frame's
 * `padding-right` (the grid's content box shrinks, so the center/conversation
 * column yields instead of being overlaid) and absolutely places the panel in
 * that strip. The host's three grid tracks are never rewritten — see
 * `layout.ts` for why that matters (issue #15). The panel React root mounts
 * into the reserved column.
 *
 * The only slot registration is the left-sidebar trigger button
 * (`sidebar.footer.action`), which toggles the column. The panel's business
 * face (close + theme) is passed by the DOM mount, not a slot inject.
 * @module @openbiliclaw/dsh-plugin
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx';
/** Required services: the slot registry (trigger button) and the shell theme. */
export declare const inject: string[];
/**
 * Client plugin body: reserve the panel strip on the frame (DOM-level, pushing
 * the center content) plus a left-sidebar toggle button.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map