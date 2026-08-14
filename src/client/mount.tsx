/**
 * DOM mounting: one React root rendered into the panel column the layout
 * controller appends to the frame grid. The root waits for its column (the
 * shell mounts asynchronously), and any DOM failure degrades the panel, never
 * the GUI boot.
 * @module @openbiliclaw/dsh-plugin
 */
import { createRoot, type Root } from 'react-dom/client'
import { OpenBiliClawPanel } from './OpenBiliClawPanel.tsx'
import { PANEL_COL_SELECTOR, type PanelLayoutController } from './layout.ts'

/** Theme face the panel follows (host light/dark scheme). */
export interface PanelThemeFace {
  isDark: () => boolean
  onThemeChange: (listener: (dark: boolean) => void) => () => void
}

/** Wait for one selector (the column the controller appends after boot). */
function waitForElement(selector: string, onFound: (el: HTMLElement) => void): () => void {
  let disposed = false
  let observer: MutationObserver | undefined
  const tryFind = (): void => {
    if (disposed) return
    const el = document.querySelector<HTMLElement>(selector)
    if (el !== null) {
      observer?.disconnect()
      onFound(el)
    }
  }
  observer = new MutationObserver(() => { tryFind() })
  observer.observe(document.body, { childList: true, subtree: true })
  tryFind()
  return () => {
    disposed = true
    observer?.disconnect()
  }
}

/**
 * Mount the OpenBiliClaw panel into the appended column.
 * @param controller - the layout controller (owns open/close).
 * @param theme - the shell theme face.
 * @returns a disposer unmounting the tree.
 */
export function mountPanel(controller: PanelLayoutController, theme: PanelThemeFace): () => void {
  let root: Root | undefined
  const dispose = waitForElement(PANEL_COL_SELECTOR, (el) => {
    root = createRoot(el)
    root.render(
      <OpenBiliClawPanel
        closePanel={() => { controller.setOpen(false) }}
        isDark={theme.isDark}
        onThemeChange={theme.onThemeChange}
      />,
    )
  })
  return () => {
    dispose()
    root?.unmount()
  }
}
