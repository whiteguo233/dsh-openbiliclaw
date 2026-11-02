/**
 * DOM layout controller for the OpenBiliClaw panel strip.
 *
 * The official DSH frame is a three-column grid (`sidebar | center | details`)
 * whose inline `grid-template-columns` belongs to `dsh-client-ui-layout`.
 * Taking that declaration over — as v0.6.3 did, appending a fourth track and
 * restating the center track as `minmax(0px, 1fr)` — breaks every consumer
 * that assumes the host's three-track contract. ds-bot's team view is the
 * visible casualty: its own left column is `position: fixed`, so it keeps
 * drawing while `_centerCol` (where ds-bot puts the conversation and the
 * composer) collapses to 0px (issue #15).
 *
 * This controller never writes `grid-template-columns`. It reserves the strip
 * with the frame's `padding-right`: the grid's content box shrinks by exactly
 * the panel width, so the center column yields the same way a pushed column
 * would, and the panel is absolutely positioned in the reserved strip. The
 * host keeps its own three tracks — including the center column's 400px floor
 * while the right bar is open — so nothing downstream can disagree with a
 * track count that was never changed.
 *
 * Two hardening rules come from #15:
 *  - the frame element can be re-mounted by a host re-render (switching to
 *    ds-bot's view does that), so the controller re-attaches as soon as its
 *    node leaves the document instead of writing into a detached tree;
 *  - `findFrame()` requires a `centerCol` sibling, so an unrelated
 *    `sidebarCol` inside a third-party view cannot capture the panel.
 *
 * Collapsing keeps the panel mounted at width 0. Failure policy: DOM wiring
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
/** Extract a track's declared minimum (minmax min, else a plain px track). */
export declare function trackMin(track: string): number;
/** Extract a track's declared maximum (minmax max, else a plain px track). */
export declare function trackMax(track: string): number;
/** The three widths the host's own frame grid declares. */
export interface ShellMetrics {
    /** Sidebar track width in px. */
    sidebar: number;
    /** The center track's declared minimum (the host's own chat floor). */
    center: number;
    /** The details (right bar) track's declared maximum. */
    details: number;
}
/**
 * Read the host's three-track grid — read-only, this plugin never writes it.
 * The details track is a `minmax(0px, Npx)` track, so its maximum is what the
 * strip has to leave room for; the center track's minimum is the floor the
 * host itself enforces while the right bar is open.
 * @param inline - `frame.style.gridTemplateColumns` as the host wrote it.
 */
export declare function readShellMetrics(inline: string): ShellMetrics;
/**
 * The panel width that still honours the host's own chat floor.
 *
 * Three limits, tightest wins:
 *  - what the user asked for (bounded by the contract min/max);
 *  - `comfortable`: the frame minus the sidebar, the right bar's declared
 *    maximum and a chat area of at least `MIN_CHAT_PX` (or the host's own
 *    larger floor) — below that the panel gives way first, so the right bar
 *    keeps its width;
 *  - `minimum`: the frame minus the sidebar and the chat floor — the right bar
 *    can collapse to 0 (the host declares `minmax(0px, Npx)`), but the
 *    conversation column may not. Below this the panel shrinks under its own
 *    usable minimum instead of sliding over the chat, and at 0 it stays closed.
 *
 * The old clamp only accounted for the sidebar, which is why the panel could
 * demand more room than the host had (issue #15).
 * @param requested - the width the user asked for (or dragged to).
 * @param frameWidth - the frame's border-box width in px.
 * @param metrics - the host grid's declared widths.
 */
export declare function clampPanelWidth(requested: number, frameWidth: number, metrics: ShellMetrics): number;
/** The frame padding that reserves the panel strip ('' when collapsed). */
export declare function reservedPadding(width: number): string;
/**
 * Locate the frame grid the panel strip is reserved in.
 *
 * The parent of a `sidebarCol` is the frame, but a third-party view can render
 * its own `sidebarCol`-ish node; only a parent that also holds a `centerCol`
 * is the real frame, so a stray node cannot capture the panel.
 */
export declare function findFrame(): HTMLElement | null;
/** The layout controller: strip reservation, column placement, toggle. */
export declare class PanelLayoutController {
    private readonly store;
    private frame;
    private column;
    private handle;
    private waitObserver;
    private styleObserver;
    private sizeObserver;
    private shellMetrics;
    private frameWidth;
    private shellStyle;
    private disposers;
    constructor(store: StateHandle<{
        open: boolean;
        width: number;
    }>);
    /** Start watching for the frame and attach once it appears (and re-attach). */
    mount(): void;
    /** Attach to the frame: strip padding, column, observers, store subscription. */
    private attach;
    /** Reserve the strip and place the column in it. */
    private apply;
    /** Read the host's declared tracks, falling back to the rendered columns. */
    private readShellMetrics;
    /** Rendered width of the first matching child (0 when absent). */
    private measuredWidth;
    /**
     * Offsets that reproduce the frame's content row inside its padding box.
     *
     * An absolutely positioned child is offset from the padding box, so the
     * frame's own vertical padding has to be re-applied by hand (Windows adds a
     * `padding-top` for the titlebar) and the bottom row (`grid-template-rows:
     * minmax(0, 1fr) auto`, whose `shell.bottom` slot another plugin may fill)
     * has to be left uncovered, exactly as the old row-1 placement did.
     */
    private contentInsets;
    /** Height of the frame's bottom row (0 when the slot is empty). */
    private bottomRowHeight;
    /** Make the frame the containing block for the absolutely placed column. */
    private ensurePositioned;
    /** Create the panel column (an absolute strip on the frame's right edge). */
    private createColumn;
    /** Create the drag handle and wire its pointer drag. */
    private createHandle;
    /** Clamp a requested width against the current frame and shell metrics. */
    private clampAt;
    /** Measure the frame width (used by the clamp). */
    private measure;
    /** Toggle the panel open/closed. */
    toggle(): void;
    /** Open or close the panel (persisted). */
    setOpen(open: boolean): void;
    /** Detach from the frame, restoring every style this controller wrote. */
    private detach;
    /** Put the frame's inline style back exactly as the host left it. */
    private restoreFrameStyles;
    /** Detach everything (plugin unload). */
    dispose(): void;
}
//# sourceMappingURL=layout.d.ts.map