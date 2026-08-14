/**
 * OpenBiliClaw drawer store: the open/closed viewing state shared between the
 * sidebar trigger button (`sidebar.footer.action`) and the floating right
 * drawer (`shell.overlay`). One handle is constructed in the client `apply`
 * world and mounted under both root-scoped slot entries, so the framework
 * resolves the SAME instance for both occupants — the button writes, the
 * drawer reads, and neither owns the state.
 * @module @openbiliclaw/dsh-plugin
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Create the shared drawer store handle. Construct in `apply` (never export a
 * handle at module level — module-cache identity is a disguised singleton
 * across plugin reloads).
 * @returns the store handle.
 */
export function createOpenBiliClawDrawerStore() {
    return defineStore({
        init: () => ({ open: false }),
        actions: {
            open: (d) => { d.open = true; },
            close: (d) => { d.open = false; },
            toggle: (d) => { d.open = !d.open; },
        },
    });
}
//# sourceMappingURL=store.js.map