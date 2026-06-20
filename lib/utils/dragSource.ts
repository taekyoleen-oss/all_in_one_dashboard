"use client";

/**
 * ============================================================================
 *  Palette → canvas drag-source bridge (설계서 §3 팔레트 드래그 추가)
 * ============================================================================
 *
 *  react-grid-layout v2 hands `onDrop` a placed LayoutItem, but its id is always
 *  the placeholder `"__dropping-elem__"` — RGL has no idea WHICH widget type the
 *  external element represented. So the palette records the dragged type here on
 *  `dragstart` and GridCanvas reads it in `onDrop`, then clears it on `dragend`.
 *
 *  A module-level slot (not React state) is correct: the value must be readable
 *  synchronously inside the native drop handler, and it never needs to trigger a
 *  re-render. (dataTransfer.getData is unavailable during dragover, so we cannot
 *  rely on it for the live drop-size; the slot is the robust path.)
 * ============================================================================
 */

let pendingType: string | null = null;

/** Called by the palette item on dragstart. */
export function setDragType(type: string): void {
  pendingType = type;
}

/** Read the type currently being dragged from the palette (or null). */
export function getDragType(): string | null {
  return pendingType;
}

/** Called on dragend / after a successful drop. */
export function clearDragType(): void {
  pendingType = null;
}
