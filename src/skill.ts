/**
 * Registers the repository's canonical openbiliclaw-adapter skill into the
 * DSH skill registry, so the model can load it through the `skill` tool and
 * operate OpenBiliClaw in a closed loop (the same SKILL.md OpenClaw/Hermes
 * consume). The file is read at plugin activation from the checkout path;
 * when unreadable the plugin logs a warning and continues without it.
 * @module @openbiliclaw/dsh-plugin
 */
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/** The skill's frontmatter keys we map onto SkillRegistration fields. */
interface Frontmatter {
  name?: string
  description?: string
  whenToUse?: string
  [key: string]: string | undefined
}

/**
 * Parse a SKILL.md frontmatter block (`---` delimited YAML-lite: `key: value`
 * lines). The repo skill uses flat scalar fields only.
 * @param raw - the full SKILL.md text.
 * @returns frontmatter and body.
 */
export function parseSkillFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const meta: Frontmatter = {}
  const trimmed = raw.replace(/^\uFEFF/, '')
  if (!trimmed.startsWith('---')) return { meta, body: trimmed }
  const end = trimmed.indexOf('\n---', 3)
  if (end < 0) return { meta, body: trimmed }
  const head = trimmed.slice(3, end)
  const body = trimmed.slice(end + 4).replace(/^\n+/, '')
  for (const line of head.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key !== '') meta[key] = value
  }
  return { meta, body }
}

/**
 * Build the skill registration from the adapter SKILL.md text.
 * @param raw - the SKILL.md text (frontmatter + body).
 * @param skillPath - absolute path of the file (surfaced to consumers).
 * @returns the registration.
 */
export function loadAdapterSkill(raw: string, skillPath: string): SkillRegistration {
  const { meta, body } = parseSkillFrontmatter(raw)
  return {
    name: meta.name ?? 'openbiliclaw_adapter',
    description: meta.description
      ?? 'Use OpenBiliClaw\'s versioned Agent Bridge to read multi-source recommendations, profile state, dialogue, probes, saved lists, and submit explicit feedback.',
    content: body.trim(),
    path: skillPath,
    source: 'runtime',
    invocation: { modelInvocable: true, userInvocable: true },
    provider: 'openbiliclaw',
    ...(meta.whenToUse !== undefined && meta.whenToUse !== '' ? { whenToUse: meta.whenToUse } : {}),
  }
}
