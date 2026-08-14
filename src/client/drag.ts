/**
 * Framework-free pointer-drag machinery for the panel width handle. One
 * pointer-down handler owns capture, a rAF-flushed move loop, every end path
 * (up / cancel / blur / lost buttons), and the drag styles. Pure DOM — no
 * React — mirroring dsh-aionui-panel's drag core.
 * @module @openbiliclaw/dsh-plugin
 */

export interface DragStartOptions {
  /** Drag left = grow (the handle sits on the panel's left edge). */
  reverse: boolean
  /** Width at drag start (read at pointer-down). */
  getStartWidth: () => number
  /** Clamped width from the raw delta. */
  compute: (startWidth: number, deltaX: number) => number
  /** Per-frame flush (rAF-merged). */
  onFrame: (width: number) => void
  /** Final commit (fired on every end path). */
  onEnd: (width: number) => void
  /** Toggle the host's "no transition while dragging" state. */
  onDragStateChange: (dragging: boolean) => void
}

/** Whether a pointer event is the primary (left) button or touch. */
function isPrimaryPointer(event: PointerEvent): boolean {
  return event.pointerType === 'touch' || event.button === 0
}

/**
 * Handle one pointer-down: wire window listeners, run the rAF loop, and end on
 * any termination path.
 * @param event - the raw pointerdown event.
 * @param el - the handle element.
 * @param opts - drag behavior.
 * @returns a disposer (idempotent; also called internally on end).
 */
export function handlePointerDragStart(event: PointerEvent, el: HTMLElement, opts: DragStartOptions): () => void {
  if (!isPrimaryPointer(event)) return () => {}
  event.preventDefault()

  const startX = event.clientX
  const startWidth = opts.getStartWidth()
  const reverse = opts.reverse
  const pointerId = event.pointerId

  let rafId: number | null = null
  let pending: number | null = null
  let latest = startWidth
  let dragging = true
  let cleaned = false

  const previousUserSelect = document.body.style.userSelect
  const previousCursor = document.body.style.cursor

  opts.onDragStateChange(true)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const flush = (): void => {
    if (pending === null) return
    latest = pending
    opts.onFrame(pending)
  }

  const computeWidth = (clientX: number): number => {
    const deltaX = reverse ? startX - clientX : clientX - startX
    return opts.compute(startWidth, deltaX)
  }

  const cleanup = (): void => {
    if (cleaned) return
    cleaned = true
    document.body.style.userSelect = previousUserSelect
    document.body.style.cursor = previousCursor
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('blur', onBlur)
  }

  const finish = (e?: PointerEvent | MouseEvent | FocusEvent): void => {
    if (!dragging) return
    dragging = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    flush()
    let finalWidth = latest
    if (e !== undefined && 'clientX' in e && typeof e.clientX === 'number') {
      finalWidth = computeWidth(e.clientX)
    }
    opts.onDragStateChange(false)
    opts.onEnd(finalWidth)
    cleanup()
  }

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return
    if (e.buttons === 0) {
      finish(e)
      return
    }
    pending = computeWidth(e.clientX)
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        flush()
      })
    }
  }
  const onUp = (e: PointerEvent): void => finish(e)
  const onCancel = (e: PointerEvent): void => finish(e)
  const onBlur = (): void => finish()

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('blur', onBlur)

  return cleanup
}
