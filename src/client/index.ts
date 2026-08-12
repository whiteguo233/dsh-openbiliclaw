/**
 * OpenBiliClaw DeepSeek Harness plugin — browser half.
 *
 * Occupies the layout's `aside` slot (the auxiliary rightmost column,
 * declared by @deepseek-ai/dsh-client-ui-layout) with the OpenBiliClaw
 * user-consumption sidebar: recommendations, delight cards, saved lists,
 * Socratic dialogue, profile + probes, and activity. The slot declaration is
 * injected through `ctx.slots.inject`, so activation order vs. ui-layout is
 * irrelevant and reload lifetimes are handled by the slot system.
 *
 * The panel's business face (collapse control + theme subscription) rides
 * the slot registration's `inject` factory — the inject-bearing register
 * overload — and joins the composed props as `OpenBiliClawInjected`.
 * @module @openbiliclaw/dsh-plugin
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { OpenBiliClawPanel, type OpenBiliClawInjected } from './OpenBiliClawPanel.tsx'

export type { OpenBiliClawPanelProps, OpenBiliClawInjected } from './OpenBiliClawPanel.tsx'

/** Required services: the slot registry, the layout panel service, and the
 *  shell theme (the panel follows the host light/dark scheme). */
export const inject = ['slots', 'layout', 'theme']

/**
 * Client plugin body: register the panel into the layout's `aside` slot.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const injected: OpenBiliClawInjected = {
    closeAside: () => { ctx.layout.closeAside() },
    isDark: () => ctx.theme.getTheme().active.colorScheme === 'dark',
    onThemeChange: (listener: (dark: boolean) => void) => (
      ctx.on('theme/change', snapshot => { listener(snapshot.active.colorScheme === 'dark') })
    ),
  }
  ctx.effect(() => ctx.slots.inject('aside', () => ctx.slots.register({
    name: 'aside',
    inject: () => injected,
  }, function OpenBiliClawAside(props: unknown) {
    // The composed share (owner geometry + framework kit + inject face) is
    // tolerated; the panel's own props are the inject face only.
    void props
    return createElement(OpenBiliClawPanel, injected)
  })), 'openbiliclaw: aside panel')
}
