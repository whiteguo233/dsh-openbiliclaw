/**
 * ABI smoke test for the built plugin against the DSH tool/skill contracts.
 *
 * `npm test` builds first (pretest), then loads the compiled node half and
 * wires it to a recording context. This proves the two things a DSH upgrade
 * breaks first: the `tool` definition shape accepted by
 * `@deepseek-ai/dsh-tools`, and the `ctx.skills.register` registration shape.
 *
 * @module @openbiliclaw/dsh-plugin/test/abi
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const plugin = await import('../lib/index.js')

/** The canonical adapter skill shipped beside the plugin source. */
const SKILL_PATH = fileURLToPath(new URL('../skills/openbiliclaw-adapter/SKILL.md', import.meta.url))

/**
 * Build a recording context that exposes the services the plugin injects.
 * `withWebServer` simulates a web profile; without it the browser bootstrap
 * route stays inert, as it does on headless surfaces.
 */
function recordingContext({ withWebServer = false } = {}) {
  const tools = []
  const skills = []
  const routes = []
  const ctx = {
    logger: () => ({ warn() {}, info() {}, error() {} }),
    effect: (callback) => {
      const dispose = callback()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    tools: {
      register: (definition) => {
        tools.push(definition)
        return () => {}
      },
    },
    skills: {
      register: (skill) => {
        skills.push(skill)
        return () => {}
      },
    },
    inject: (deps, callback) => {
      if (!withWebServer || !deps.includes('webServer')) return
      const child = {
        ...ctx,
        webServer: {
          register: (route) => {
            routes.push(route)
            return () => {}
          },
        },
      }
      callback(child)
    },
  }
  return { ctx, tools, skills, routes }
}

test('plugin declares the DSH services it injects', () => {
  assert.equal(plugin.name, 'openbiliclaw')
  assert.deepEqual([...plugin.inject].sort(), ['skills', 'tools'])
})

test('registers every bridge tool with a DSH-valid definition', () => {
  const { ctx, tools } = recordingContext()
  plugin.apply(ctx, { skillPath: SKILL_PATH })
  assert.equal(tools.length, 22, 'bridge tool count')
  const names = new Set()
  for (const tool of tools) {
    assert.equal(typeof tool.name, 'string')
    assert.ok(tool.name.startsWith('openbiliclaw_'), `${tool.name} keeps the bridge prefix`)
    assert.equal(names.has(tool.name), false, `${tool.name} is unique`)
    names.add(tool.name)
    assert.equal(typeof tool.description, 'string')
    assert.equal(tool.parameters?.type, 'object', `${tool.name} declares an object parameter schema`)
    assert.notEqual(tool.output?.schema, undefined, `${tool.name} declares an output schema`)
    assert.equal(typeof tool.execute, 'function')
  }
})

test('registers the adapter skill from an explicit SKILL.md path', async () => {
  const { ctx, skills } = recordingContext()
  plugin.apply(ctx, { skillPath: SKILL_PATH })
  assert.equal(skills.length, 1)
  const [skill] = skills
  assert.equal(skill.name, 'openbiliclaw-adapter')
  assert.equal(skill.invocation.modelInvocable, true)
  assert.equal(skill.path, SKILL_PATH)
  assert.ok(skill.content.length > 0)
  const raw = await readFile(SKILL_PATH, 'utf8')
  assert.ok(raw.includes(skill.content.slice(0, 40)), 'registered content comes from the canonical SKILL.md')
})

test('a missing SKILL.md logs a warning instead of failing activation', () => {
  const { ctx, skills, tools } = recordingContext()
  assert.doesNotThrow(() => plugin.apply(ctx, { skillPath: '/nonexistent/openbiliclaw/SKILL.md' }))
  assert.equal(skills.length, 0)
  assert.equal(tools.length, 22, 'tools still register')
})

test('browser bootstrap route exposes the row apiUrl on the web surface', () => {
  const { ctx, routes } = recordingContext({ withWebServer: true })
  plugin.apply(ctx, { apiUrl: 'http://127.0.0.1:18420' })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, '/openbiliclaw/connection')
  assert.equal(routes[0].kind, 'exact')
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(body) { this.body = body },
  }
  assert.doesNotThrow(() => routes[0].handler({ method: 'GET' }, res))
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(res.body), { apiUrl: 'http://127.0.0.1:18420', version: 1 })
})

test('browser bootstrap route rejects writes and stays out of headless surfaces', () => {
  const web = recordingContext({ withWebServer: true })
  plugin.apply(web.ctx, {})
  assert.equal(web.routes.length, 1)

  const rejected = { headers: {}, setHeader(name, value) { this.headers[name] = value }, end() {} }
  web.routes[0].handler({ method: 'POST' }, rejected)
  assert.equal(rejected.statusCode, 405)
  assert.equal(rejected.headers.allow, 'GET, HEAD')

  const answered = { headers: {}, setHeader(name, value) { this.headers[name] = value }, end(body) { this.body = body } }
  web.routes[0].handler({ method: 'GET' }, answered)
  assert.deepEqual(JSON.parse(answered.body), { apiUrl: 'http://127.0.0.1:8420', version: 1 })

  const headless = recordingContext()
  assert.doesNotThrow(() => plugin.apply(headless.ctx, {}))
  assert.equal(headless.routes.length, 0, 'no route without a web server')
})

test('save-local splits a platform-prefixed item key instead of double-prefixing it', () => {
  // The bridge CLI composes `<platform>:<content-id>` itself, so the tool must
  // hand it the bare id. `bilibili:bilibili:BV...` used to reach the database.
  assert.deepEqual(plugin.splitItemKey('bilibili:BV1Ennp6SE5B'), { sourcePlatform: 'bilibili', contentId: 'BV1Ennp6SE5B' })
  assert.deepEqual(plugin.splitItemKey('github:repository:946380199'), { sourcePlatform: 'github', contentId: 'repository:946380199' })
  assert.deepEqual(plugin.splitItemKey('twitter:12345'), { sourcePlatform: 'x', contentId: '12345' })
  assert.equal(plugin.splitItemKey('BV1Ennp6SE5B'), null, 'a bare bvid carries no prefix')
  assert.equal(plugin.splitItemKey('not-a-platform:thing'), null, 'unknown prefixes pass through untouched')

  assert.deepEqual(
    plugin.resolveSaveTarget('bilibili:BV1Ennp6SE5B', undefined),
    { sourcePlatform: 'bilibili', contentId: 'BV1Ennp6SE5B' },
  )
  assert.deepEqual(
    plugin.resolveSaveTarget('bilibili:BV1Ennp6SE5B', 'bilibili'),
    { sourcePlatform: 'bilibili', contentId: 'BV1Ennp6SE5B' },
  )
  assert.deepEqual(
    plugin.resolveSaveTarget('BV1Ennp6SE5B', undefined),
    { sourcePlatform: 'bilibili', contentId: 'BV1Ennp6SE5B' },
  )
  assert.deepEqual(
    plugin.resolveSaveTarget('BV1Ennp6SE5B', 'douyin'),
    { sourcePlatform: 'douyin', contentId: 'BV1Ennp6SE5B' },
  )
})
