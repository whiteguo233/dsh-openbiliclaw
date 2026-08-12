/** Parse the bridge CLI's single JSON line from captured stdout. */
export function parseBridgeLine(stdout) {
    const trimmed = stdout.trim();
    if (trimmed === '')
        throw new Error('openbiliclaw bridge: empty output');
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        throw new Error(`openbiliclaw bridge: non-JSON output: ${trimmed.slice(0, 400)}`);
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error(`openbiliclaw bridge: unexpected payload shape: ${trimmed.slice(0, 400)}`);
    }
    const reply = parsed;
    if (reply.ok !== true) {
        const err = reply;
        throw new Error(`openbiliclaw bridge error: ${String(err.error ?? err.message ?? 'unknown')}`);
    }
    return { ok: true, data: reply.data };
}
/**
 * Build the bridge face over the harness shell service (the renamed `bash`
 * seam in newer DSH snapshots; both expose the same resolve/run surface).
 * Commands run with the checkout as workdir so `config.toml` / `data/`
 * resolve exactly like the running backend's; the default pythonBin is that
 * checkout's `.venv`.
 * @param shell - the harness shell service (ctx.shell).
 * @param config - resolved plugin config.
 * @returns the bridge face.
 */
export function createBridge(shell, config) {
    return {
        config,
        async run(command, args) {
            const argv = [config.pythonBin, '-m', 'openbiliclaw.integrations.openclaw.cli', command, ...args];
            const spec = shell.resolve({
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
            });
            const result = await shell.run(spec);
            const stdout = result.stdout.text;
            if (result.exitCode !== 0) {
                // The interesting exception is the TAIL of a python traceback, not the head.
                const stderr = result.stderr.text.trim();
                const tail = stderr.length > 1500 ? stderr.slice(stderr.length - 1500) : stderr;
                throw new Error(`openbiliclaw bridge exited ${String(result.exitCode)}: ${tail || stdout.slice(-1500)}`);
            }
            const reply = parseBridgeLine(stdout);
            return reply.data;
        },
    };
}
/** Single-quote a shell argument (argv is built for one bash command line). */
function shellQuote(value) {
    if (/^[A-Za-z0-9_./:=,@%+^~-]+$/.test(value))
        return value;
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
//# sourceMappingURL=bridge.js.map