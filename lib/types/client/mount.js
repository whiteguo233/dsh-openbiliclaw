import { jsx as _jsx } from "react/jsx-runtime";
/**
 * DOM mounting: one React root rendered into the panel column the layout
 * controller appends to the frame grid. The root waits for its column (the
 * shell mounts asynchronously), and any DOM failure degrades the panel, never
 * the GUI boot.
 * @module @openbiliclaw/dsh-plugin
 */
import { createRoot } from 'react-dom/client';
import { OpenBiliClawPanel } from "./OpenBiliClawPanel.js";
import { PANEL_COL_SELECTOR } from "./layout.js";
/** Wait for one selector (the column the controller appends after boot). */
function waitForElement(selector, onFound) {
    let disposed = false;
    let observer;
    const tryFind = () => {
        if (disposed)
            return;
        const el = document.querySelector(selector);
        if (el !== null) {
            observer?.disconnect();
            onFound(el);
        }
    };
    observer = new MutationObserver(() => { tryFind(); });
    observer.observe(document.body, { childList: true, subtree: true });
    tryFind();
    return () => {
        disposed = true;
        observer?.disconnect();
    };
}
/**
 * Mount the OpenBiliClaw panel into the appended column.
 * @param controller - the layout controller (owns open/close).
 * @param theme - the shell theme face.
 * @returns a disposer unmounting the tree.
 */
export function mountPanel(controller, theme) {
    let root;
    const dispose = waitForElement(PANEL_COL_SELECTOR, (el) => {
        root = createRoot(el);
        root.render(_jsx(OpenBiliClawPanel, { closePanel: () => { controller.setOpen(false); }, isDark: theme.isDark, onThemeChange: theme.onThemeChange }));
    });
    return () => {
        dispose();
        root?.unmount();
    };
}
//# sourceMappingURL=mount.js.map