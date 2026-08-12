/**
 * Build config for the OpenBiliClaw DSH plugin, using the deployment's own
 * client-bundle preset (tsdown.client.ts): the node half builds from the tsc
 * output (lib/types), the browser half becomes the `window.__ModuleLoader__`
 * closure bundle at lib/client.js. Run after `tsc -p tsconfig.json`:
 *
 *   tsc -p tsconfig.json && tsdown --env.DSH_BUILD_FACE client
 *
 * @module @openbiliclaw/dsh-plugin
 */
import { clientBundle } from '/Users/white/.dsh/source/current/packages/client/tsdown.client.ts'

export default clientBundle('@openbiliclaw/dsh-plugin', ['lib/types/index.js'])
