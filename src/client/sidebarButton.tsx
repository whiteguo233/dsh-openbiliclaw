/**
 * The OpenBiliClaw trigger button: the `sidebar.footer.action` occupant, a
 * foot action rendered beside Settings at the sidebar bottom. In the wide
 * sidebar it is a full-width row (brand mark + label); in the collapsed rail
 * it is the 36px icon control. Clicking toggles the shared drawer store.
 * @module @openbiliclaw/dsh-plugin
 */
import type { PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { BRAND_ICON } from './brandIcon.ts'
import { createOpenBiliClawDrawerStore } from './store.ts'
import css from './panel.module.css'

type StoreShare = PropsStore<ReturnType<typeof createOpenBiliClawDrawerStore>>

/** Composed props: the sidebar's `wide` owner share + the shared store share. */
export type OpenBiliClawSidebarButtonProps = { wide: boolean } & StoreShare

/**
 * Render the sidebar trigger row.
 * @param props - `wide` (column display state) + `useStore`/`actions`.
 * @returns the trigger button.
 */
export function OpenBiliClawSidebarButton({ wide, useStore, actions }: OpenBiliClawSidebarButtonProps): React.JSX.Element {
  const open = useStore(s => s.open)
  return (
    <button
      type="button"
      className={css.sidebarButton}
      data-wide={wide || undefined}
      data-active={open || undefined}
      title="OpenBiliClaw"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => { actions.toggle() }}
    >
      <img className={css.sidebarButtonIcon} src={BRAND_ICON} alt="" aria-hidden="true" />
      {wide ? <span className={css.sidebarButtonLabel}>OpenBiliClaw</span> : null}
    </button>
  )
}
