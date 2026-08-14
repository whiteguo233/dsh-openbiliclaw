/**
 * The OpenBiliClaw trigger button: the `sidebar.footer.action` occupant, a
 * foot action rendered beside Settings at the sidebar bottom. In the wide
 * sidebar it is a full-width row (brand mark + label); in the collapsed rail
 * it is the 36px icon control. Clicking toggles the shared drawer store.
 * @module @openbiliclaw/dsh-plugin
 */
import type { PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createOpenBiliClawDrawerStore } from './store.ts';
type StoreShare = PropsStore<ReturnType<typeof createOpenBiliClawDrawerStore>>;
/** Composed props: the sidebar's `wide` owner share + the shared store share. */
export type OpenBiliClawSidebarButtonProps = {
    wide: boolean;
} & StoreShare;
/**
 * Render the sidebar trigger row.
 * @param props - `wide` (column display state) + `useStore`/`actions`.
 * @returns the trigger button.
 */
export declare function OpenBiliClawSidebarButton({ wide, useStore, actions }: OpenBiliClawSidebarButtonProps): React.JSX.Element;
export {};
//# sourceMappingURL=sidebarButton.d.ts.map