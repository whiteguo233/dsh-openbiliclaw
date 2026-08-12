/**
 * Agent-bridge CLI invocation through the harness bash service. Every tool
 * shells out to `python -m openbiliclaw.integrations.openclaw.cli` (the
 * host-neutral agent-bridge/v2 JSON contract OpenClaw/Hermes/WorkBuddy share),
 * parses the JSON line, and turns `{"ok": false, ...}` payloads into thrown
 * errors — the skill's working rules: parse JSON, surface errors, stop.
 * @module @openbiliclaw/dsh-plugin
 */
import type { BashExecRequest, BashRunResult } from '@deepseek-ai/dsh-bash'
import type { JsonValue } from '@deepseek-ai/dsh-session'

/** Resolved plugin config (defaults applied in the plugin entry). */
export interface BridgeConfig {
  /** Python interpreter of the OpenBiliClaw environment. */
  pythonBin: string
  /** OpenBiliClaw checkout directory (config.toml + data/ live here). */
  workdir: string
  /** Absolute path of the adapter SKILL.md, or '' to skip registration. */
  skillPath: string
  /** Per-command budget in ms. */
  timeoutMs: number
  /** Max stdout bytes captured per command. */
  stdoutMaxBytes: number
}

/** The bridge service face the tools need (narrowed bash + config). */
export interface Bridge {
  readonly config: BridgeConfig
  /** Run one bridge command with CLI-style argv; returns the parsed `data` payload as lossless JSON. */
  run(command: string, args: readonly string[]): Promise<JsonValue>
}

/** A successful bridge reply: `{"ok": true, "data": ...}`. */
export interface BridgeOk {
  ok: true
  data: unknown
}

/** A failed bridge reply: `{"ok": false, ...}`. */
export interface BridgeError {
  ok: false
  error?: string
  message?: string
  [key: string]: unknown
}

/** Parse the bridge CLI's single JSON line from captured stdout. */
export function parseBridgeLine(stdout: string): BridgeOk | BridgeError {
  const trimmed = stdout.trim()
  if (trimmed === '') throw new Error('openbiliclaw bridge: empty output')
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(`openbiliclaw bridge: non-JSON output: ${trimmed.slice(0, 400)}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`openbiliclaw bridge: unexpected payload shape: ${trimmed.slice(0, 400)}`)
  }
  const reply = parsed as Record<string, unknown>
  if (reply.ok !== true) {
    const err = reply as BridgeError
    throw new Error(`openbiliclaw bridge error: ${String(err.error ?? err.message ?? 'unknown')}`)
  }
  return { ok: true, data: reply.data }
}

/**
 * Build the bridge face over the harness bash service. Commands run with the
 * checkout as workdir so `config.toml` / `data/` resolve exactly like the
 * running backend's; the default pythonBin is that checkout's `.venv`.
 * @param bash - the harness bash service (ctx.bash).
 * @param config - resolved plugin config.
 * @returns the bridge face.
 */
export function createBridge(bash: {
  resolve(request: BashExecRequest): unknown
  run(spec: unknown): Promise<BashRunResult>
}, config: BridgeConfig): Bridge {
  return {
    config,
    async run(command: string, args: readonly string[]): Promise<JsonValue> {
      const argv = [config.pythonBin, '-m', 'openbiliclaw.integrations.openclaw.cli', command, ...args]
      const spec = bash.resolve({
        command: argv.map(shellQuote).join(' '),
        workdir: config.workdir,
        timeoutMs: config.timeoutMs,
        stdoutMaxBytes: config.stdoutMaxBytes,
        // The bridge opens the checkout's SQLite DB read-write and writes
        // data/ state; confine writes to the OpenBiliClaw checkout instead of
        // the caller's session workspace (the deployment default).
        sandboxPolicy: {
          mode: 'workspace-write',
          workspaceRoot: config.workdir,
        },
      })
      const result = await bash.run(spec)
      const stdout = result.stdout.text
      if (result.exitCode !== 0) {
        // The interesting exception is the TAIL of a python traceback, not the head.
        const stderr = result.stderr.text.trim()
        const tail = stderr.length > 1500 ? stderr.slice(stderr.length - 1500) : stderr
        throw new Error(
          `openbiliclaw bridge exited ${String(result.exitCode)}: ${tail || stdout.slice(-1500)}`,
        )
      }
      const reply = parseBridgeLine(stdout)
      return reply.data as JsonValue
    },
  }
}

/** Single-quote a shell argument (argv is built for one bash command line). */
function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,@%+^~-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}
