/**
 * Browser-half bootstrap: read the backend address the host plugin row is
 * configured with.
 *
 * The node half registers `GET /openbiliclaw/connection` (same origin) and
 * returns its resolved `apiUrl`. Reading it before the panel mounts keeps the
 * panel and the `openbiliclaw_*` tools pointed at the same backend; without
 * it the panel would silently use its built-in `127.0.0.1:8420` default while
 * the tools talked to whatever the row named.
 *
 * The request is relative to `document.baseURI` (the idiom DSH's own client
 * plugins use for host routes), so a mounted sub-path keeps working. Failure
 * is non-fatal: the panel falls back to its stored setting or the default.
 * @module @openbiliclaw/dsh-plugin
 */
import { setHostApiBase } from './api.ts'

/** Host route registered by the node half (see CONNECTION_ROUTE there). */
const CONNECTION_PATH = 'openbiliclaw/connection'

/** One shared in-flight read: the bootstrap runs once per page load. */
let pending: Promise<string | null> | undefined

/**
 * Read the host row's backend address and adopt it as the panel fallback.
 * @returns the announced address, or null when the host route is unavailable.
 */
export function loadHostApiBase(): Promise<string | null> {
  pending ??= requestConnection()
  return pending
}

/** Perform the one request; never rejects. */
async function requestConnection(): Promise<string | null> {
  try {
    const url = new URL(CONNECTION_PATH, document.baseURI)
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const apiUrl = typeof body === 'object' && body !== null
      ? (body as { apiUrl?: unknown }).apiUrl
      : undefined
    if (typeof apiUrl !== 'string' || apiUrl.trim() === '') return null
    setHostApiBase(apiUrl)
    return apiUrl
  } catch {
    return null
  }
}
