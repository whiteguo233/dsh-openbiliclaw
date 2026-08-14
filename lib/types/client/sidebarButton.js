import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BRAND_ICON } from "./brandIcon.js";
import css from './panel.module.css';
/**
 * Render the sidebar trigger row.
 * @param props - `wide` (column display state) + `useStore`/`actions`.
 * @returns the trigger button.
 */
export function OpenBiliClawSidebarButton({ wide, useStore, actions }) {
    const open = useStore(s => s.open);
    return (_jsxs("button", { type: "button", className: css.sidebarButton, "data-wide": wide || undefined, "data-active": open || undefined, title: "OpenBiliClaw", "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => { actions.toggle(); }, children: [_jsx("img", { className: css.sidebarButtonIcon, src: BRAND_ICON, alt: "", "aria-hidden": "true" }), wide ? _jsx("span", { className: css.sidebarButtonLabel, children: "OpenBiliClaw" }) : null] }));
}
//# sourceMappingURL=sidebarButton.js.map