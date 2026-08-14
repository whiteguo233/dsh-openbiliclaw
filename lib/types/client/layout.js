import { PANEL_DEFAULT_WIDTH_PX, PANEL_MAX_WIDTH_PX, PANEL_MIN_WIDTH_PX, MIN_CHAT_PX, persistPanelOpen, persistPanelWidth, } from "./store.js";
import { handlePointerDragStart } from "./drag.js";
/** The column element marker (mount.tsx targets it). */
export const PANEL_COL_SELECTOR = '[data-obc-panel-col]';
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
/** Extract a px width from one track (0 for fr/minmax/non-px tracks). */
export function trackPx(track) {
    const match = /^(-?[\d.]+)px$/.exec(track.trim());
    return match === null ? 0 : Number(match[1]);
}
/** Locate the frame grid the panel column appends into. */
function findFrame() {
    return document.querySelector('[class*="sidebarCol"]')?.parentElement ?? null;
}
/** The layout controller: frame sync, column append, grid rewrite, toggle. */
export class PanelLayoutController {
    store;
    frame = null;
    column = null;
    handle = null;
    styleObserver = null;
    sizeObserver = null;
    waitObserver = null;
    shellTracks = [];
    frameWidth = 0;
    disposers = [];
    constructor(store) {
        this.store = store;
    }
    /** Start watching for the frame and attach once it appears. */
    mount() {
        const tryAttach = () => {
            if (this.frame !== null)
                return;
            const frame = findFrame();
            if (frame === null)
                return;
            this.attach(frame);
        };
        this.waitObserver = new MutationObserver(() => { tryAttach(); });
        this.waitObserver.observe(document.body, { childList: true, subtree: true });
        tryAttach();
    }
    /** Attach to the frame: column, observers, store subscription. */
    attach(frame) {
        this.frame = frame;
        const column = document.createElement('div');
        column.dataset.obcPanelCol = '';
        column.style.minWidth = '0';
        column.style.overflow = 'hidden';
        column.style.display = 'flex';
        column.style.flexDirection = 'column';
        column.style.visibility = 'hidden';
        frame.appendChild(column);
        this.column = column;
        // The absolute drag handle (out of the grid flow), on the panel's left edge.
        const handle = this.createHandle();
        frame.appendChild(handle);
        this.handle = handle;
        // Mirror every shell grid write: any write that isn't ours re-appends ours.
        this.styleObserver = new MutationObserver(() => { this.syncGrid(); });
        this.styleObserver.observe(frame, { attributes: true, attributeFilter: ['style'] });
        // Measure the row width for the clamp, then re-apply on resize.
        this.sizeObserver = new ResizeObserver(() => {
            this.measure();
            this.applyGrid();
        });
        this.sizeObserver.observe(frame);
        // Store -> DOM.
        this.disposers.push(this.store.subscribe(() => { this.applyGrid(); }));
        // Initial sync: read the shell's inline grid (already applied).
        const initial = frame.style.gridTemplateColumns;
        if (initial !== '') {
            const tracks = parseGridTracks(initial);
            if (tracks.length >= 2)
                this.shellTracks = tracks;
        }
        this.measure();
        this.applyGrid();
    }
    /** Re-write the frame grid and toggle the column visibility. */
    applyGrid() {
        if (this.frame === null)
            return;
        if (this.shellTracks.length < 2)
            return;
        const state = this.store.getSnapshot();
        const width = state.open ? this.clampWidth(state.width) : 0;
        // Shell tracks: [sidebar, center, details, ...]; center is always the
        // fluid track, so it is re-stated as minmax(0px, 1fr) (the browser's own
        // serialization of minmax(0, 1fr)) while every other shell track is
        // preserved verbatim, then our panel column is appended.
        const shell = this.shellTracks;
        const grid = `${shell[0]} minmax(0px, 1fr) ${shell.slice(2).join(' ')} ${Math.round(width)}px`.trim();
        this.frame.style.gridTemplateColumns = grid;
        if (this.column !== null) {
            this.column.style.visibility = width > 0 ? 'visible' : 'hidden';
        }
        if (this.handle !== null) {
            const left = Math.round(this.frameWidth - width);
            this.handle.style.left = `${left}px`;
            this.handle.style.display = width > 0 ? 'block' : 'none';
        }
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
                compute: (start, delta) => this.clampWidth(start + delta),
                onFrame: (width) => {
                    this.store.update((prev) => (prev.width === width ? prev : { ...prev, width }));
                },
                onEnd: (width) => {
                    this.store.update((prev) => (prev.width === width ? prev : { ...prev, width }));
                    persistPanelWidth(width);
                    this.applyGrid();
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
            this.applyGrid();
        });
        return el;
    }
    /** Clamp the requested width so the chat area keeps at least MIN_CHAT_PX. */
    clampWidth(requested) {
        const sidebar = this.shellTracks.length >= 1 ? trackPx(this.shellTracks[0] ?? '') : 0;
        const details = this.shellTracks.length >= 3 ? trackPx(this.shellTracks[2] ?? '') : 0;
        const available = Math.max(0, this.frameWidth - sidebar - details);
        const maxByContainer = Math.max(PANEL_MIN_WIDTH_PX, available - MIN_CHAT_PX);
        return Math.min(PANEL_MAX_WIDTH_PX, Math.min(requested, maxByContainer));
    }
    /**
     * Mirror shell grid writes. Our own write is the shell's track count plus
     * one (the panel column), so a write at that count is kept; any other write
     * is the shell's (or a foreign plugin's), so its tracks are remembered and
     * our column is re-appended. Track count — not string equality — detects the
     * two cases, because the browser re-serializes `minmax(0, 1fr)` as
     * `minmax(0px, 1fr)` and a string comparison would never match.
     */
    syncGrid() {
        if (this.frame === null)
            return;
        const inline = this.frame.style.gridTemplateColumns;
        if (inline === '')
            return;
        const tracks = parseGridTracks(inline);
        if (tracks.length === this.shellTracks.length + 1)
            return;
        if (tracks.length >= 2) {
            this.shellTracks = tracks;
            this.applyGrid();
        }
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
        this.applyGrid();
    }
    /** Detach everything (plugin unload). */
    dispose() {
        this.waitObserver?.disconnect();
        this.styleObserver?.disconnect();
        this.sizeObserver?.disconnect();
        for (const dispose of this.disposers)
            dispose();
        this.column?.remove();
        this.handle?.remove();
        this.frame = null;
        this.column = null;
        this.handle = null;
    }
}
//# sourceMappingURL=layout.js.map