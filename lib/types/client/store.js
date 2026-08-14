/**
 * Framework-free state for the OpenBiliClaw panel column. The panel is
 * DOM-mounted outside any DSH slot (the official layout has no `aside`), so
 * its open/closed state and width live here — a minimal subscribe/getSnapshot/
 * update primitive — instead of the layout service. Width is fixed for now;
 * the open state persists across reloads.
 * @module @openbiliclaw/dsh-plugin
 */
/** Create a state handle with an immutable snapshot (new object per update). */
export function createState(initial) {
    let state = initial;
    const listeners = new Set();
    return {
        getSnapshot: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        update(fn) {
            const next = fn(state);
            if (next === state)
                return;
            state = next;
            for (const listener of listeners)
                listener();
        },
    };
}
/** Panel column width contract. */
export const PANEL_DEFAULT_WIDTH_PX = 380;
export const PANEL_MIN_WIDTH_PX = 280;
export const PANEL_MAX_WIDTH_PX = 560;
/** The chat area never shrinks below this (panel clamps to leave room). */
export const MIN_CHAT_PX = 400;
/** localStorage key for the persisted open/closed preference. */
const KEY_PANEL_OPEN = 'openbiliclaw:panel-open';
/** Read the persisted open preference (default: open). */
export function readPanelOpen() {
    try {
        return localStorage.getItem(KEY_PANEL_OPEN) !== 'closed';
    }
    catch {
        return true;
    }
}
/** Persist the open preference. */
export function persistPanelOpen(open) {
    try {
        localStorage.setItem(KEY_PANEL_OPEN, open ? 'open' : 'closed');
    }
    catch {
        // best-effort
    }
}
/** Create the panel layout store. */
export function createPanelLayoutStore() {
    return createState({
        open: readPanelOpen(),
        width: PANEL_DEFAULT_WIDTH_PX,
    });
}
//# sourceMappingURL=store.js.map