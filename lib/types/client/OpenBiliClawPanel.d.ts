/** Business face injected by the overlay drawer registration. */
export interface OpenBiliClawInjected {
    /** Close the drawer (shared store transition, driven by the panel's collapse button). */
    closeDrawer: () => void;
    /** Whether the shell theme is currently dark. */
    isDark: () => boolean;
    /** Subscribe to shell theme changes. Returns the unsubscriber. */
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/** Panel props: the business face injected by the overlay drawer registration.
 *  (The registration inject face is the only share this panel consumes; the
 *  drawer owner handles its own geometry and close semantics.) */
export type OpenBiliClawPanelProps = OpenBiliClawInjected;
/**
 * The drawer body: OpenBiliClaw user-consumption panel.
 * @param props - injected actions (close + theme).
 */
export declare function OpenBiliClawPanel({ closeDrawer, isDark, onThemeChange }: OpenBiliClawPanelProps): React.JSX.Element;
//# sourceMappingURL=OpenBiliClawPanel.d.ts.map