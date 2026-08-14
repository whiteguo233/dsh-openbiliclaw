import { createOpenBiliClawDrawerStore } from "./store.js";
import { OpenBiliClawSidebarButton } from "./sidebarButton.js";
import { OpenBiliClawDrawer } from "./drawer.js";
/** Required services: the slot registry and the shell theme (the panel follows
 *  the host light/dark scheme). */
export const inject = ['slots', 'theme'];
/**
 * Client plugin body: register the sidebar trigger button and the floating
 * right drawer, both bound to the same shared drawer store.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const store = createOpenBiliClawDrawerStore();
    const theme = {
        isDark: () => ctx.theme.getTheme().active.colorScheme === 'dark',
        onThemeChange: (listener) => (ctx.on('theme/change', snapshot => { listener(snapshot.active.colorScheme === 'dark'); })),
    };
    // Left-sidebar trigger button (additive foot action beside Settings).
    ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'openbiliclaw',
        store,
    }, OpenBiliClawSidebarButton)), 'openbiliclaw: sidebar button');
    // Floating right drawer (additive frame-wide overlay entry).
    ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'openbiliclaw-drawer',
        store,
        inject: () => theme,
    }, OpenBiliClawDrawer)), 'openbiliclaw: overlay drawer');
}
//# sourceMappingURL=index.js.map