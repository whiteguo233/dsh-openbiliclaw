/**
 * DOM layout controller for the OpenBiliClaw panel column.
 *
 * The official DSH frame is a three-column grid (`sidebar | center | details`);
 * there is no root-scoped `aside` slot and `ctx.layout` has no aside verbs, so
 * the panel cannot claim a column through the slot system. This controller
 * extends the frame grid directly — the same technique as dsh-aionui-panel:
 * it appends one trailing grid item (the panel column) and re-writes the
 * frame's inline `grid-template-columns` with the shell's own tracks followed
 * by the panel width. A MutationObserver mirrors every shell grid write, so
 * the panel column survives sidebar/details changes; the shell's inline style
 * is always the source of truth (never guessed).
 *
 * Collapsing keeps the column mounted at width 0. Failure policy: DOM wiring
 * errors are logged, never thrown — a plugin apply throw fails the whole GUI.
 * @module @openbiliclaw/dsh-plugin
 */
import type { StateHandle } from './store.ts';
/** The column element marker (mount.tsx targets it). */
export declare const PANEL_COL_SELECTOR = "[data-obc-panel-col]";
/** Parse an inline grid-template-columns string into its tracks (paren-safe). */
export declare function parseGridTracks(input: string): string[];
/** Extract a px width from one track (0 for fr/minmax/non-px tracks). */
export declare function trackPx(track: string): number;
/** The layout controller: frame sync, column append, grid rewrite, toggle. */
export declare class PanelLayoutController {
    private readonly store;
    private frame;
    private column;
    private handle;
    private styleObserver;
    private sizeObserver;
    private waitObserver;
    private shellTracks;
    private frameWidth;
    private disposers;
    constructor(store: StateHandle<{
        open: boolean;
        width: number;
    }>);
    /** Start watching for the frame and attach once it appears. */
    mount(): void;
    /** Attach to the frame: column, observers, store subscription. */
    private attach;
    /** Re-write the frame grid and toggle the column visibility. */
    private applyGrid;
    /** Create the drag handle and wire its pointer drag. */
    private createHandle;
    /** Clamp the requested width so the chat area keeps at least MIN_CHAT_PX. */
    private clampWidth;
    /**
     * Mirror shell grid writes. Our own write is the shell's track count plus
     * one (the panel column), so a write at that count is kept; any other write
     * is the shell's (or a foreign plugin's), so its tracks are remembered and
     * our column is re-appended. Track count — not string equality — detects the
     * two cases, because the browser re-serializes `minmax(0, 1fr)` as
     * `minmax(0px, 1fr)` and a string comparison would never match.
     */
    private syncGrid;
    /** Measure the frame width (used by the clamp). */
    private measure;
    /** Toggle the panel open/closed. */
    toggle(): void;
    /** Open or close the panel (persisted). */
    setOpen(open: boolean): void;
    /** Detach everything (plugin unload). */
    dispose(): void;
}
//# sourceMappingURL=layout.d.ts.map