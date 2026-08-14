/** Composed props: the sidebar's `wide` owner share + the injected toggle. */
export type OpenBiliClawSidebarButtonProps = {
    wide: boolean;
    togglePanel: () => void;
};
/**
 * Render the sidebar trigger row.
 * @param props - `wide` (column display state) + `togglePanel` callback.
 * @returns the trigger button.
 */
export declare function OpenBiliClawSidebarButton({ wide, togglePanel }: OpenBiliClawSidebarButtonProps): React.JSX.Element;
//# sourceMappingURL=sidebarButton.d.ts.map