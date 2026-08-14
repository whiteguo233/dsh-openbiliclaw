/**
 * The OpenBiliClaw floating right drawer: the `shell.overlay` occupant. It
 * renders a click-away backdrop plus a right-aligned panel that slides in over
 * every column, without occupying the details/aside tracks. The panel stays
 * mounted across open/close (state, WebSocket, and health probes survive), and
 * visibility is driven by the shared drawer store so the sidebar button and
 * the backdrop/close control write to the same cell.
 * @module @openbiliclaw/dsh-plugin
 */
import type { PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createOpenBiliClawDrawerStore } from './store.ts';
type StoreShare = PropsStore<ReturnType<typeof createOpenBiliClawDrawerStore>>;
/** Theme face the drawer forwards to the panel (host light/dark scheme). */
export interface OpenBiliClawThemeFace {
    /** Whether the shell theme is currently dark. */
    isDark: () => boolean;
    /** Subscribe to shell theme changes. Returns the unsubscriber. */
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/** Composed props: the shared store share + the injected theme face. */
export type OpenBiliClawDrawerProps = StoreShare & OpenBiliClawThemeFace;
/**
 * Render the floating drawer (always mounted; hidden off-canvas when closed).
 * @param props - store share + injected theme face.
 * @returns the drawer overlay element tree.
 */
export declare function OpenBiliClawDrawer({ useStore, actions, isDark, onThemeChange }: OpenBiliClawDrawerProps): React.JSX.Element;
export {};
//# sourceMappingURL=drawer.d.ts.map