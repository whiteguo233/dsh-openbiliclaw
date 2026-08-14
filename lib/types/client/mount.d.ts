import { type PanelLayoutController } from './layout.ts';
/** Theme face the panel follows (host light/dark scheme). */
export interface PanelThemeFace {
    isDark: () => boolean;
    onThemeChange: (listener: (dark: boolean) => void) => () => void;
}
/**
 * Mount the OpenBiliClaw panel into the appended column.
 * @param controller - the layout controller (owns open/close).
 * @param theme - the shell theme face.
 * @returns a disposer unmounting the tree.
 */
export declare function mountPanel(controller: PanelLayoutController, theme: PanelThemeFace): () => void;
//# sourceMappingURL=mount.d.ts.map