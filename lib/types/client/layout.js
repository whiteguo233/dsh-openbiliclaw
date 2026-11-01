import { PANEL_DEFAULT_WIDTH_PX, PANEL_MAX_WIDTH_PX, PANEL_MIN_WIDTH_PX, MIN_CHAT_PX, persistPanelOpen, persistPanelWidth, } from "./store.js";
import { handlePointerDragStart } from "./drag.js";
/** The column element marker (mount.tsx targets it). */
export const PANEL_COL_SELECTOR = '[data-obc-panel-col]';
/** Host frame column selectors (the grid this plugin reads but never writes). */
const SIDEBAR_SELECTOR = '[class*="sidebarCol"]';
const CENTER_SELECTOR = '[class*="centerCol"]';
const DETAILS_SELECTOR = '[class*="rightbarCol"]';
/** Parse an inline grid-template-columns string into its tracks (paren-safe). */
export function parseGridTracks(input) {
    const tracks = [];
    let depth = 0;
    let current = '';
    for (const char of input) {
        if (char === '(')
            depth += 1;
        if (char === ')')
            depth = Math.max(0, depth - 1);
        if (char === ' ' && depth === 0) {
            if (current !== '') {
                tracks.push(current);
                current = '';
            }
            continue;
        }
        current += char;
    }
    if (current !== '')
        tracks.push(current);
    return tracks;
}
/** Parse one track token to px, or null when it is not a plain `<n>px`. */
function parsePx(token) {
    const match = /^(-?\d+(?:\.\d+)?)px$/.exec(token.trim());
    return match === null ? null : Number(match[1]);
}
/** Split `minmax(a, b)` into its bounds, or null for any other track. */
function minmaxBounds(track) {
    const trimmed = track.trim();
    if (!trimmed.startsWith('minmax(') || !trimmed.endsWith(')'))
        return null;
    const parts = trimmed.slice('minmax('.length, -1).split(',');
    const min = parts[0]?.trim() ?? '';
    const max = parts[1]?.trim() ?? '';
    return min === '' || max === '' ? null : { min, max };
}
/** Extract a px width from one track (0 for fr/minmax/non-px tracks). */
export function trackPx(track) {
    return parsePx(track) ?? 0;
}
/** Extract a track's declared minimum (minmax min, else a plain px track). */
export function trackMin(track) {
    const bounds = minmaxBounds(track);
    return parsePx(bounds === null ? track : bounds.min) ?? 0;
}
/** Extract a track's declared maximum (minmax max, else a plain px track). */
export function trackMax(track) {
    const bounds = minmaxBounds(track);
    return parsePx(bounds === null ? track : bounds.max) ?? 0;
}
/**
 * Read the host's three-track grid — read-only, this plugin never writes it.
 * The details track is a `minmax(0px, Npx)` track, so its maximum is what the
 * strip has to leave room for; the center track's minimum is the floor the
 * host itself enforces while the right bar is open.
 * @param inline - `frame.style.gridTemplateColumns` as the host wrote it.
 */
export function readShellMetrics(inline) {
    const tracks = inline.trim() === '' ? [] : parseGridTracks(inline);
    return {
        sidebar: tracks.length >= 1 ? trackPx(tracks[0] ?? '') : 0,
        center: tracks.length >= 2 ? trackMin(tracks[1] ?? '') : 0,
        details: tracks.length >= 3 ? trackMax(tracks[2] ?? '') : 0,
    };
}
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
export function clampPanelWidth(requested, frameWidth, metrics) {
    const chatFloor = Math.max(MIN_CHAT_PX, metrics.center);
    const comfortable = Math.max(PANEL_MIN_WIDTH_PX, frameWidth - metrics.sidebar - metrics.details - chatFloor);
    const minimum = Math.max(0, frameWidth - metrics.sidebar - chatFloor);
    const wanted = Math.min(PANEL_MAX_WIDTH_PX, Math.max(PANEL_MIN_WIDTH_PX, requested));
    return Math.min(wanted, comfortable, minimum);
}
/** The frame padding that reserves the panel strip ('' when collapsed). */
export function reservedPadding(width) {
    return width > 0 ? `${Math.round(width)}px` : '';
}
/**
 * Locate the frame grid the panel strip is reserved in.
 *
 * The parent of a `sidebarCol` is the frame, but a third-party view can render
 * its own `sidebarCol`-ish node; only a parent that also holds a `centerCol`
 * is the real frame, so a stray node cannot capture the panel.
 */
export function findFrame() {
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    for (const sidebar of sidebars) {
        const parent = sidebar.parentElement;
        if (parent === null)
            continue;
        if (parent.querySelector(`:scope > ${CENTER_SELECTOR}`) !== null)
            return parent;
    }
    return sidebars[0]?.parentElement ?? null;
}
/** The layout controller: strip reservation, column placement, toggle. */
export class PanelLayoutController {
    store;
    frame = null;
    column = null;
    handle = null;
    waitObserver = null;
    styleObserver = null;
    sizeObserver = null;
    shellMetrics = { sidebar: 0, center: MIN_CHAT_PX, details: 0 };
    frameWidth = 0;
    shellStyle = { paddingRight: '', boxSizing: '', position: '' };
    disposers = [];
    constructor(store) {
        this.store = store;
    }
    /** Start watching for the frame and attach once it appears (and re-attach). */
    mount() {
        const tryAttach = () => {
            const current = findFrame();
            if (current === null)
                return;
            // A host re-render can replace the frame: our node then leaves the
            // document while the panel still points at it, so re-attach on the new one.
            if (this.frame !== null && document.contains(this.frame))
                return;
            this.detach();
            this.attach(current);
        };
        this.waitObserver = new MutationObserver(() => { tryAttach(); });
        this.waitObserver.observe(document.body, { childList: true, subtree: true });
        tryAttach();
    }
    /** Attach to the frame: strip padding, column, observers, store subscription. */
    attach(frame) {
        this.frame = frame;
        this.shellStyle = {
            paddingRight: typeof frame.style.paddingRight === 'string' ? frame.style.paddingRight : '',
            boxSizing: typeof frame.style.boxSizing === 'string' ? frame.style.boxSizing : '',
            position: typeof frame.style.position === 'string' ? frame.style.position : '',
        };
        this.ensurePositioned();
        const column = this.createColumn();
        frame.appendChild(column);
        this.column = column;
        // The absolute drag handle (out of the flow), on the panel's left edge.
        const handle = this.createHandle();
        frame.appendChild(handle);
        this.handle = handle;
        // Re-clamp when the host rewrites its own tracks (right bar opens/closes).
        // Our own padding writes land here too; apply() is idempotent, so that
        // pass writes nothing and the loop ends.
        this.styleObserver = new MutationObserver(() => { this.apply(); });
        this.styleObserver.observe(frame, { attributes: true, attributeFilter: ['style'] });
        // Measure the frame width for the clamp, then re-apply on resize.
        this.sizeObserver = new ResizeObserver(() => {
            this.measure();
            this.apply();
        });
        this.sizeObserver.observe(frame);
        // Store -> DOM.
        this.disposers.push(this.store.subscribe(() => { this.apply(); }));
        this.measure();
        this.apply();
    }
    /** Reserve the strip and place the column in it. */
    apply() {
        const frame = this.frame;
        if (frame === null)
            return;
        this.readShellMetrics();
        const state = this.store.getSnapshot();
        const width = state.open ? clampPanelWidth(state.width, this.frameWidth, this.shellMetrics) : 0;
        // The strip: the grid's content box shrinks by the padding, so the center
        // track yields exactly like it would for an appended column — while the
        // host keeps writing its own three tracks untouched.
        const padding = reservedPadding(width);
        if (frame.style.paddingRight !== padding)
            frame.style.paddingRight = padding;
        const boxSizing = padding === '' ? this.shellStyle.boxSizing : 'border-box';
        if (frame.style.boxSizing !== boxSizing)
            frame.style.boxSizing = boxSizing;
        if (this.column !== null) {
            // Re-pin if a foreign cleanup detached the column (never throw).
            if (this.column.parentElement !== frame)
                frame.appendChild(this.column);
            this.column.style.width = `${Math.round(width)}px`;
            this.column.style.visibility = width > 0 ? 'visible' : 'hidden';
            this.column.style.pointerEvents = width > 0 ? 'auto' : 'none';
            // The frame's grid rows are `minmax(0, 1fr) auto`, and an absolutely
            // positioned child is offset from the padding box — so reproduce the old
            // row-1 extent explicitly: below the frame's own padding, above the
            // bottom row another plugin may have filled.
            const insets = this.contentInsets();
            this.column.style.top = `${insets.top}px`;
            this.column.style.bottom = `${insets.bottom}px`;
        }
        if (this.handle !== null) {
            this.handle.style.left = `${Math.round(this.frameWidth - width)}px`;
            this.handle.style.display = width > 0 ? 'block' : 'none';
        }
    }
    /** Read the host's declared tracks, falling back to the rendered columns. */
    readShellMetrics() {
        const frame = this.frame;
        if (frame === null)
            return;
        const inline = typeof frame.style.gridTemplateColumns === 'string' ? frame.style.gridTemplateColumns : '';
        if (inline.trim() !== '') {
            this.shellMetrics = readShellMetrics(inline);
            return;
        }
        // The host has not written its grid yet (first paint): measure instead.
        this.shellMetrics = {
            sidebar: this.measuredWidth(SIDEBAR_SELECTOR),
            center: MIN_CHAT_PX,
            details: this.measuredWidth(DETAILS_SELECTOR),
        };
    }
    /** Rendered width of the first matching child (0 when absent). */
    measuredWidth(selector) {
        const el = this.frame?.querySelector(selector) ?? null;
        return el === null ? 0 : Math.round(el.getBoundingClientRect().width);
    }
    /**
     * Offsets that reproduce the frame's content row inside its padding box.
     *
     * An absolutely positioned child is offset from the padding box, so the
     * frame's own vertical padding has to be re-applied by hand (Windows adds a
     * `padding-top` for the titlebar) and the bottom row (`grid-template-rows:
     * minmax(0, 1fr) auto`, whose `shell.bottom` slot another plugin may fill)
     * has to be left uncovered, exactly as the old row-1 placement did.
     */
    contentInsets() {
        const frame = this.frame;
        if (frame === null)
            return { top: 0, bottom: 0 };
        let top = 0;
        let bottom = 0;
        try {
            if (typeof globalThis.getComputedStyle === 'function') {
                const style = globalThis.getComputedStyle(frame);
                top = Number.parseFloat(style.paddingTop) || 0;
                bottom = Number.parseFloat(style.paddingBottom) || 0;
            }
        }
        catch {
            top = 0;
            bottom = 0;
        }
        return { top, bottom: bottom + this.bottomRowHeight() };
    }
    /** Height of the frame's bottom row (0 when the slot is empty). */
    bottomRowHeight() {
        const el = this.frame?.querySelector('[data-shell-bottom]') ?? null;
        return el === null ? 0 : Math.round(el.getBoundingClientRect().height);
    }
    /** Make the frame the containing block for the absolutely placed column. */
    ensurePositioned() {
        const frame = this.frame;
        if (frame === null)
            return;
        let position = '';
        try {
            position = typeof globalThis.getComputedStyle === 'function'
                ? globalThis.getComputedStyle(frame).position
                : '';
        }
        catch {
            position = '';
        }
        if (position === 'static' || position === '')
            frame.style.position = 'relative';
    }
    /** Create the panel column (an absolute strip on the frame's right edge). */
    createColumn() {
        const column = document.createElement('div');
        column.dataset.obcPanelCol = '';
        column.style.position = 'absolute';
        column.style.top = '0';
        column.style.bottom = '0';
        column.style.right = '0';
        column.style.width = '0px';
        column.style.minWidth = '0';
        column.style.overflow = 'hidden';
        column.style.display = 'flex';
        column.style.flexDirection = 'column';
        column.style.visibility = 'hidden';
        column.style.pointerEvents = 'none';
        return column;
    }
    /** Create the drag handle and wire its pointer drag. */
    createHandle() {
        const el = document.createElement('div');
        el.className = 'obc-panel-handle';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.bottom = '0';
        el.style.zIndex = '30';
        el.style.width = '8px';
        el.style.marginLeft = '-4px';
        el.style.cursor = 'col-resize';
        el.style.display = 'none';
        el.addEventListener('pointerdown', (event) => {
            handlePointerDragStart(event, el, {
                reverse: true,
                getStartWidth: () => this.store.getSnapshot().width,
                compute: (start, delta) => this.clampAt(start + delta),
                onFrame: (width) => {
                    this.store.update((prev) => (prev.width === width ? prev : { ...prev, width }));
                },
                onEnd: (width) => {
                    this.store.update((prev) => (prev.width === width ? prev : { ...prev, width }));
                    persistPanelWidth(width);
                    this.apply();
                },
                onDragStateChange: (dragging) => {
                    if (this.frame !== null)
                        this.frame.style.transition = dragging ? 'none' : '';
                },
            });
        });
        // Double-click resets to the contract default width.
        el.addEventListener('dblclick', () => {
            this.store.update((prev) => (prev.width === PANEL_DEFAULT_WIDTH_PX ? prev : { ...prev, width: PANEL_DEFAULT_WIDTH_PX }));
            persistPanelWidth(PANEL_DEFAULT_WIDTH_PX);
            this.apply();
        });
        return el;
    }
    /** Clamp a requested width against the current frame and shell metrics. */
    clampAt(requested) {
        return clampPanelWidth(requested, this.frameWidth, this.shellMetrics);
    }
    /** Measure the frame width (used by the clamp). */
    measure() {
        if (this.frame === null)
            return;
        this.frameWidth = this.frame.getBoundingClientRect().width;
    }
    /** Toggle the panel open/closed. */
    toggle() {
        this.setOpen(!this.store.getSnapshot().open);
    }
    /** Open or close the panel (persisted). */
    setOpen(open) {
        this.store.update((prev) => (prev.open === open ? prev : { ...prev, open }));
        persistPanelOpen(open);
        this.apply();
    }
    /** Detach from the frame, restoring every style this controller wrote. */
    detach() {
        this.restoreFrameStyles();
        this.styleObserver?.disconnect();
        this.styleObserver = null;
        this.sizeObserver?.disconnect();
        this.sizeObserver = null;
        for (const dispose of this.disposers)
            dispose();
        this.disposers = [];
        this.column?.remove();
        this.handle?.remove();
        this.frame = null;
        this.column = null;
        this.handle = null;
    }
    /** Put the frame's inline style back exactly as the host left it. */
    restoreFrameStyles() {
        const frame = this.frame;
        if (frame === null)
            return;
        if (frame.style.paddingRight !== this.shellStyle.paddingRight)
            frame.style.paddingRight = this.shellStyle.paddingRight;
        if (frame.style.boxSizing !== this.shellStyle.boxSizing)
            frame.style.boxSizing = this.shellStyle.boxSizing;
        if (frame.style.position !== this.shellStyle.position)
            frame.style.position = this.shellStyle.position;
    }
    /** Detach everything (plugin unload). */
    dispose() {
        this.waitObserver?.disconnect();
        this.waitObserver = null;
        this.detach();
    }
}
//# sourceMappingURL=layout.js.map