import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Business face injected by the aside slot registration. */
export interface OpenBiliClawInjected {
    /** Close the aside panel (layout service transition). */
    closeAside: () => void;
    /** Whether the shell theme is currently dark. */
    isDark: () => boolean;
    /** Subscribe to shell theme changes. Returns the unsubscriber. */
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/** Full props: runtime share (owner params + standard kit) + injected face. */
export type OpenBiliClawPanelProps = PropsRuntime<'aside'> & OpenBiliClawInjected;
/**
 * The aside occupant: OpenBiliClaw user-consumption sidebar.
 * @param props - runtime share + injected actions.
 */
export declare function OpenBiliClawPanel({ closeAside, isDark, onThemeChange }: OpenBiliClawPanelProps): React.JSX.Element;
//# sourceMappingURL=OpenBiliClawPanel.d.ts.map