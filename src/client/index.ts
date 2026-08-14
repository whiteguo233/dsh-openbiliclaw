/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The panel no longer occupies the layout's `aside` column (removed in current
 * DSH). Instead it mounts on two additive root-scoped seats:
 *   - `sidebar.footer.action` — the left-sidebar trigger button beside
 *     Settings, which toggles the drawer open/closed;
 *   - `shell.overlay` — the frame-wide floating layer, where the panel renders
 *     as a right-side drawer sliding over every column (so it never competes
 *     with the details / files / changes panel).
 *
 * Both seats share one drawer store handle built in `apply`, so the button and
 * the drawer read/write the same open/closed cell. Registrations ride
 * `ctx.slots.inject`, so activation order vs. ui-sidebar / ui-layout is
 * irrelevant and reload lifetimes are handled by the slot system. The panel's
 * business face (theme subscription + close) rides the overlay registration's
 * `inject` factory — the inject-bearing register overload — and joins the
 * composed props as `OpenBiliClawInjected`.
 * @module @openbiliclaw/dsh-plugin
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-layout's SlotMap merge (`shell.overlay`) and ui-sidebar's
// SlotMap merge (`sidebar.footer.action`) into this program so the two
// registrations below typecheck against the real declarations.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { createOpenBiliClawDrawerStore } from './store.ts'
import { OpenBiliClawSidebarButton } from './sidebarButton.tsx'
import { OpenBiliClawDrawer, type OpenBiliClawThemeFace } from './drawer.tsx'

export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx'

/** Required services: the slot registry and the shell theme (the panel follows
 *  the host light/dark scheme). */
export const inject = ['slots', 'theme']

/**
 * Client plugin body: register the sidebar trigger button and the floating
 * right drawer, both bound to the same shared drawer store.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const store = createOpenBiliClawDrawerStore()
  const theme: OpenBiliClawThemeFace = {
    isDark: () => ctx.theme.getTheme().active.colorScheme === 'dark',
    onThemeChange: (listener: (dark: boolean) => void) => (
      ctx.on('theme/change', snapshot => { listener(snapshot.active.colorScheme === 'dark') })
    ),
  }

  // Left-sidebar trigger button (additive foot action beside Settings).
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'openbiliclaw',
    store,
  }, OpenBiliClawSidebarButton)), 'openbiliclaw: sidebar button')

  // Floating right drawer (additive frame-wide overlay entry).
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'openbiliclaw-drawer',
    store,
    inject: () => theme,
  }, OpenBiliClawDrawer)), 'openbiliclaw: overlay drawer')
}
