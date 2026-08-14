/**
 * Framework-free pointer-drag machinery for the panel width handle. One
 * pointer-down handler owns capture, a rAF-flushed move loop, every end path
 * (up / cancel / blur / lost buttons), and the drag styles. Pure DOM — no
 * React — mirroring dsh-aionui-panel's drag core.
 * @module @openbiliclaw/dsh-plugin
 */
export interface DragStartOptions {
    /** Drag left = grow (the handle sits on the panel's left edge). */
    reverse: boolean;
    /** Width at drag start (read at pointer-down). */
    getStartWidth: () => number;
    /** Clamped width from the raw delta. */
    compute: (startWidth: number, deltaX: number) => number;
    /** Per-frame flush (rAF-merged). */
    onFrame: (width: number) => void;
    /** Final commit (fired on every end path). */
    onEnd: (width: number) => void;
    /** Toggle the host's "no transition while dragging" state. */
    onDragStateChange: (dragging: boolean) => void;
}
/**
 * Handle one pointer-down: wire window listeners, run the rAF loop, and end on
 * any termination path.
 * @param event - the raw pointerdown event.
 * @param el - the handle element.
 * @param opts - drag behavior.
 * @returns a disposer (idempotent; also called internally on end).
 */
export declare function handlePointerDragStart(event: PointerEvent, el: HTMLElement, opts: DragStartOptions): () => void;
//# sourceMappingURL=drag.d.ts.map