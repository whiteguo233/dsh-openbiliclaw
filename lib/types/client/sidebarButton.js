import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The OpenBiliClaw trigger button: the `sidebar.footer.action` occupant, a
 * foot action rendered beside Settings at the sidebar bottom. In the wide
 * sidebar it is a full-width row (brand mark + label); in the collapsed rail
 * it is the 36px icon control. Clicking toggles the panel column (which pushes
 * the center content instead of overlaying it).
 * @module @openbiliclaw/dsh-plugin
 */
import { BRAND_ICON } from "./brandIcon.js";
import css from './panel.module.css';
/**
 * Render the sidebar trigger row.
 * @param props - `wide` (column display state) + `togglePanel` callback.
 * @returns the trigger button.
 */
export function OpenBiliClawSidebarButton({ wide, togglePanel }) {
    return (_jsxs("button", { type: "button", className: css.sidebarButton, "data-wide": wide || undefined, title: "OpenBiliClaw", onClick: togglePanel, children: [_jsx("img", { className: css.sidebarButtonIcon, src: BRAND_ICON, alt: "", "aria-hidden": "true" }), wide ? _jsx("span", { className: css.sidebarButtonLabel, children: "OpenBiliClaw" }) : null] }));
}
//# sourceMappingURL=sidebarButton.js.map