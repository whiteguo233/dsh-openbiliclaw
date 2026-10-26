/**
 * Build config for the OpenBiliClaw DSH plugin.
 *
 * Two artifacts, both under `lib/`:
 *  - `lib/index.js`  — the node half, an ESM bundle of the tsc output
 *    (`lib/types/index.js`) whose `@deepseek-ai/*` imports stay external (the
 *    DSH profile supplies them).
 *  - `lib/client.js` — the browser half, a closure-factory bundle in DSH's
 *    frozen module-table contract:
 *      window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *    Only frozen platform modules (React, react-dom) stay external; everything
 *    else is inlined. CSS Modules compile through lightningcss and inject one
 *    `<style data-plugin=...>` tag at factory execution, matching the DSH
 *    client-bundle preset this package used to import from the DSH checkout.
 *
 * Run after `tsc -p tsconfig.json` (the client entry is emitted JS):
 *
 *   tsc -p tsconfig.json && tsdown
 *
 * @module @openbiliclaw/dsh-plugin
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Plugin id stamped into the module table hand-off and the injected styles. */
const PLUGIN_ID = '@openbiliclaw/dsh-plugin'

/**
 * Frozen platform modules the browser loader answers through `require()`.
 * Anything outside this list must be bundled (a require the table cannot
 * answer throws at boot).
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
]

/**
 * Wire/type-only DSH packages safe to inline: no runtime identity (no
 * Symbol/instanceof state) is shared with the host, so a copy is harmless.
 */
const INLINE_SAFE = /^@deepseek-ai\/dsh-(session|llm|tools|brand|util-values|skill)(\/|$)/

/** Virtual-id wrapper keeping module CSS out of tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0obc-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** The node half: ESM bundle consumed by the DSH loader, DSH imports external. */
const nodeHalf: UserConfig = {
  name: PLUGIN_ID,
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  external: [...PLATFORM_MODULES, INLINE_SAFE],
}

/** Resolve an emitted JS asset import back to its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = '/lib/types/'
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}

/** The browser half: closure-factory bundle for the DSH client module table. */
const clientHalf: UserConfig = {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...PLATFORM_MODULES],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (PLATFORM_MODULES.includes(id) ? undefined : true),
  plugins: [
    {
      // Bundle purity gate: platform entries stay external, inline-safe wire
      // layers inline, and every other @deepseek-ai value import is a build
      // error — the frozen module table cannot answer it.
      name: 'obc-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (PLATFORM_MODULES.includes(source)) return null
        if (INLINE_SAFE.test(source)) return null
        throw new Error(
          `client bundle purity: "${source}" is not a frozen platform module or an inline-safe wire layer — `
          + 'collaborate through cordis services (type-only imports are erased and never reach this gate)',
        )
      },
    },
    {
      name: 'obc-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        // The virtual id otherwise hides the physical stylesheet from the watch graph.
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        // lightningcss's own [hash] placeholder is process-random, so two builds
        // of unchanged sources produced different class names and a rewritten
        // bundle every time. Hash the repo-relative path + content instead: the
        // class names stay stable across machines, checkouts and rebuilds.
        const cssHash = createHash('sha256')
          .update(`${relative(process.cwd(), fileId).split(sep).join('/')}\n`)
          .update(source)
          .digest('hex')
          .slice(0, 6)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: `_${cssHash}_[local]` },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        // lightningcss exposes the export map in hash order; sort it so the
        // emitted object (and therefore the bundle) is byte-stable per build.
        for (const [local, exp] of Object.entries(cssExports ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) classMap[local] = exp.name
        return [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(`${PLUGIN_ID}/${basename(fileId)}`)};`,
          'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
          '  const tag = document.createElement(\'style\');',
          `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      },
    },
  ],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([nodeHalf, clientHalf])
