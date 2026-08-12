/** Business face injected by the aside slot registration. */
export interface OpenBiliClawInjected {
    /** Close the aside panel (layout service transition). */
    closeAside: () => void;
    /** Whether the shell theme is currently dark. */
    isDark: () => boolean;
    /** Subscribe to shell theme changes. Returns the unsubscriber. */
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/** Panel props: the business face injected by the aside slot registration.
 *  (Newer DSH snapshots narrow the aside owner share to column geometry and
 *  drop the occupant inject slot; the registration inject face is the only
 *  share this panel consumes.) */
export type OpenBiliClawPanelProps = OpenBiliClawInjected;
/**
 * The aside occupant: OpenBiliClaw user-consumption sidebar.
 * @param props - runtime share + injected actions.
 */
export declare function OpenBiliClawPanel({ closeAside, isDark, onThemeChange }: OpenBiliClawPanelProps): React.JSX.Element;
//# sourceMappingURL=OpenBiliClawPanel.d.ts.map