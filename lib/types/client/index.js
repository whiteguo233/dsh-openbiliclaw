import { OpenBiliClawPanel } from "./OpenBiliClawPanel.js";
/** Required services: the slot registry, the layout panel service, and the
 *  shell theme (the panel follows the host light/dark scheme). */
export const inject = ['slots', 'layout', 'theme'];
/**
 * Client plugin body: register the panel into the layout's `aside` slot.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.slots.inject('aside', () => ctx.slots.register({
        name: 'aside',
        inject: () => ({
            closeAside: () => { ctx.layout.closeAside(); },
            isDark: () => ctx.theme.getTheme().active.colorScheme === 'dark',
            onThemeChange: (listener) => (ctx.on('theme/change', snapshot => { listener(snapshot.active.colorScheme === 'dark'); })),
        }),
    }, OpenBiliClawPanel)), 'openbiliclaw: aside panel');
}
//# sourceMappingURL=index.js.map