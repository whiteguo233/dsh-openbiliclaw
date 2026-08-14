import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { OpenBiliClawPanel } from "./OpenBiliClawPanel.js";
import css from './panel.module.css';
/**
 * Render the floating drawer (always mounted; hidden off-canvas when closed).
 * @param props - store share + injected theme face.
 * @returns the drawer overlay element tree.
 */
export function OpenBiliClawDrawer({ useStore, actions, isDark, onThemeChange }) {
    const open = useStore(s => s.open);
    return (_jsxs("div", { className: css.drawerRoot, "data-open": open || undefined, children: [_jsx("div", { className: css.drawerBackdrop, "aria-hidden": "true", onClick: () => { actions.close(); } }), _jsx("aside", { className: css.drawer, "aria-label": "OpenBiliClaw", children: _jsx(OpenBiliClawPanel, { closeDrawer: () => { actions.close(); }, isDark: isDark, onThemeChange: onThemeChange }) })] }));
}
//# sourceMappingURL=drawer.js.map