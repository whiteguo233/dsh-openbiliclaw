/**
 * Registers the repository's canonical openbiliclaw-adapter skill into the
 * DSH skill registry, so the model can load it through the `skill` tool and
 * operate OpenBiliClaw in a closed loop (the same SKILL.md OpenClaw/Hermes
 * consume). The file is read at plugin activation from the checkout path;
 * when unreadable the plugin logs a warning and continues without it.
 * @module @openbiliclaw/dsh-plugin
 */
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
/** The skill's frontmatter keys we map onto SkillRegistration fields. */
interface Frontmatter {
    name?: string;
    description?: string;
    whenToUse?: string;
    [key: string]: string | undefined;
}
/**
 * Parse a SKILL.md frontmatter block (`---` delimited YAML-lite: `key: value`
 * lines). The repo skill uses flat scalar fields only.
 * @param raw - the full SKILL.md text.
 * @returns frontmatter and body.
 */
export declare function parseSkillFrontmatter(raw: string): {
    meta: Frontmatter;
    body: string;
};
/**
 * Build the skill registration from the adapter SKILL.md text.
 * @param raw - the SKILL.md text (frontmatter + body).
 * @param skillPath - absolute path of the file (surfaced to consumers).
 * @returns the registration.
 */
export declare function loadAdapterSkill(raw: string, skillPath: string): SkillRegistration;
export {};
//# sourceMappingURL=skill.d.ts.map