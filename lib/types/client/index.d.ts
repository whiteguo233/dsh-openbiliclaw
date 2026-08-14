/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The official DSH layout has no root-scoped `aside` slot and `ctx.layout` has
 * no aside verbs, so the panel cannot claim a column through the slot system.
 * Instead this plugin extends the frame grid directly (the dsh-aionui-panel
 * technique): a `PanelLayoutController` appends one trailing grid column and
 * re-writes the frame's `grid-template-columns` with the shell's tracks plus
 * the panel width, so opening the panel PUSHES the center/conversation column
 * instead of overlaying it. The panel React root mounts into that column.
 *
 * The only slot registration is the left-sidebar trigger button
 * (`sidebar.footer.action`), which toggles the column. The panel's business
 * face (close + theme) is passed by the DOM mount, not a slot inject.
 * @module @openbiliclaw/dsh-plugin
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx';
/** Required services: the slot registry (trigger button) and the shell theme. */
export declare const inject: string[];
/**
 * Client plugin body: mount the panel column into the frame grid (DOM-level,
 * pushing the center content) plus a left-sidebar toggle button.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map