/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * The official DSH layout has no root-scoped `aside` slot and `ctx.layout` has
 * no aside verbs, so the panel cannot claim a column through the slot system.
 * Instead this plugin extends the frame grid directly (the dsh-aionui-panel
 * technique): a `PanelLayoutController` appends one trailing grid column and
 * re-writes the frame's `grid-template-columns` with the shell's tracks plus
 * the panel width, so opening the panel PUSHES the center/conversation column
 * instead of overlaying it. The panel React root mounts into that column.
 *
 * The only slot registration is the left-sidebar trigger button
 * (`sidebar.footer.action`), which toggles the column. The panel's business
 * face (close + theme) is passed by the DOM mount, not a slot inject.
 * @module @openbiliclaw/dsh-plugin
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-sidebar's SlotMap merge (`sidebar.footer.action`) and the
// theme plugin's Context merge (ctx.theme) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { createPanelLayoutStore } from './store.ts'
import { PanelLayoutController } from './layout.ts'
import { mountPanel, type PanelThemeFace } from './mount.tsx'
import { OpenBiliClawSidebarButton } from './sidebarButton.tsx'

export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx'

/** Required services: the slot registry (trigger button) and the shell theme. */
export const inject = ['slots', 'theme']

/**
 * Client plugin body: mount the panel column into the frame grid (DOM-level,
 * pushing the center content) plus a left-sidebar toggle button.
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
  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      layout.mount()
      disposers.push(mountPanel(layout, theme))
    } catch (error) {
      console.error('[openbiliclaw] panel mount failed:', error)
    }
    return () => {
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
