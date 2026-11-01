/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The official DSH layout has no root-scoped `aside` slot and `ctx.layout` has
 * no aside verbs, so the panel cannot claim a column through the slot system.
 * Instead a `PanelLayoutController` reserves a strip with the frame's
 * `padding-right` (the grid's content box shrinks, so the center/conversation
 * column yields instead of being overlaid) and absolutely places the panel in
 * that strip. The host's three grid tracks are never rewritten — see
 * `layout.ts` for why that matters (issue #15). The panel React root mounts
 * into the reserved column.
 *
 * The only slot registration is the left-sidebar trigger button
 * (`sidebar.footer.action`), which toggles the column. The panel's business
 * face (close + theme) is passed by the DOM mount, not a slot inject.
 * @module @openbiliclaw/dsh-plugin
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls ui-sidebar's SlotMap merge (`sidebar.footer.action`) and the
// theme plugin's Context merge (ctx.theme) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { createPanelLayoutStore } from './store.ts'
import { PanelLayoutController } from './layout.ts'
import { loadHostApiBase } from './host.ts'
import { mountPanel, type PanelThemeFace } from './mount.tsx'
import { OpenBiliClawSidebarButton } from './sidebarButton.tsx'

export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx'

/** Required services: the slot registry (trigger button) and the shell theme. */
export const inject = ['slots', 'theme']

/**
 * Client plugin body: reserve the panel strip on the frame (DOM-level, pushing
 * the center content) plus a left-sidebar toggle button.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const store = createPanelLayoutStore()
  const layout = new PanelLayoutController(store)
  const theme: PanelThemeFace = {
    isDark: () => ctx.theme.getTheme().active.colorScheme === 'dark',
    onThemeChange: (listener: (dark: boolean) => void) => (
      ctx.on('theme/change', snapshot => { listener(snapshot.active.colorScheme === 'dark') })
    ),
  }

  // Wire the column + panel. DOM failures degrade the panel, never the GUI.
  // The panel waits for the host row's backend address (one same-origin read)
  // so its first render already targets the backend the tools use.
  ctx.effect(() => {
    const disposers: Array<() => void> = []
    let disposed = false
    let disposePanel: (() => void) | undefined
    try {
      layout.mount()
      void loadHostApiBase().finally(() => {
        if (disposed) return
        try {
          disposePanel = mountPanel(layout, theme)
        } catch (error) {
          console.error('[openbiliclaw] panel mount failed:', error)
        }
      })
    } catch (error) {
      console.error('[openbiliclaw] panel mount failed:', error)
    }
    return () => {
      disposed = true
      disposePanel?.()
      for (const dispose of disposers) dispose()
      layout.dispose()
    }
  }, 'openbiliclaw: panel wiring')

  // Left-sidebar trigger (additive foot action beside Settings).
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'openbiliclaw',
    inject: () => ({ togglePanel: () => { layout.toggle() } }),
  }, OpenBiliClawSidebarButton)), 'openbiliclaw: sidebar button')
}
