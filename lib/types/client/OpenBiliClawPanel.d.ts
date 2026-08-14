/** Business face passed to the panel by the DOM mount. */
export interface OpenBiliClawInjected {
    /** Close the panel column (driven by the panel's collapse button). */
    closePanel: () => void;
    /** Whether the shell theme is currently dark. */
    isDark: () => boolean;
    /** Subscribe to shell theme changes. Returns the unsubscriber. */
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/** Panel props: the business face passed by the DOM mount (close + theme). */
export type OpenBiliClawPanelProps = OpenBiliClawInjected;
/**
 * The panel column body: OpenBiliClaw user-consumption panel.
 * @param props - injected actions (close + theme).
 */
export declare function OpenBiliClawPanel({ closePanel, isDark, onThemeChange }: OpenBiliClawPanelProps): React.JSX.Element;
//# sourceMappingURL=OpenBiliClawPanel.d.ts.map