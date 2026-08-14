/**
 * Framework-free state for the OpenBiliClaw panel column. The panel is
 * DOM-mounted outside any DSH slot (the official layout has no `aside`), so
 * its open/closed state and width live here — a minimal subscribe/getSnapshot/
 * update primitive — instead of the layout service. Width is fixed for now;
 * the open state persists across reloads.
 * @module @openbiliclaw/dsh-plugin
 */
/** A minimal external store usable with useSyncExternalStore. */
export interface StateHandle<S> {
    getSnapshot: () => S;
    subscribe: (listener: () => void) => () => void;
    /** Pure update: fn receives the previous state and returns the next. */
    update: (fn: (prev: S) => S) => void;
}
/** Create a state handle with an immutable snapshot (new object per update). */
export declare function createState<S>(initial: S): StateHandle<S>;
/** Panel column width contract. */
export declare const PANEL_DEFAULT_WIDTH_PX = 380;
export declare const PANEL_MIN_WIDTH_PX = 280;
export declare const PANEL_MAX_WIDTH_PX = 560;
/** The chat area never shrinks below this (panel clamps to leave room). */
export declare const MIN_CHAT_PX = 400;
/** Panel layout state. */
export interface PanelLayoutState {
    /** Whether the panel column is shown (width > 0). */
    open: boolean;
    /** Requested column width in px. */
    width: number;
}
/** Read the persisted open preference (default: open). */
export declare function readPanelOpen(): boolean;
/** Persist the open preference. */
export declare function persistPanelOpen(open: boolean): void;
/** Create the panel layout store. */
export declare function createPanelLayoutStore(): StateHandle<PanelLayoutState>;
//# sourceMappingURL=store.d.ts.map