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

/** Build a recording context that exposes the services the plugin injects. */
function recordingContext() {
  const tools = []
  const skills = []
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
  }
  return { ctx, tools, skills }
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
