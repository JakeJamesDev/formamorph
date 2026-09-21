import type { DragEvent as ReactDragEvent } from 'react';
import type { NodeKey } from 'lexical';

/** Browsers require a payload before they will begin a native drag. */
export const CHIP_DRAG_MIME = 'application/x-formamorph-chip';
const TARGET_MIME_PREFIX = `${CHIP_DRAG_MIME}-target-`;

export type ChipDragKey = { current: NodeKey | null };

function setChipDragImage(event: ReactDragEvent<HTMLElement>): void {
  const chip = event.currentTarget.matches('[data-chip]')
    ? event.currentTarget
    : event.currentTarget.querySelector<HTMLElement>('[data-chip]') ?? event.currentTarget;
  const wrap = document.createElement('div');
  wrap.dataset.chipDragGhost = '';
  wrap.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:16px 0 0 16px;pointer-events:none';
  const ghost = chip.cloneNode(true) as HTMLElement;
  ghost.style.opacity = '0.6';
  ghost.style.margin = '0';
  wrap.appendChild(ghost);
  document.body.appendChild(wrap);
  event.dataTransfer.setDragImage(wrap, 0, 0);
  setTimeout(() => wrap.remove(), 0);
}

/** Starts a reusable palette drag. The receiving vocabulary mints the fresh placement on drop. */
export function startPaletteChipDrag(
  event: ReactDragEvent<HTMLElement>, paletteToken: string, editorKey?: string,
): void {
  event.dataTransfer.setData(CHIP_DRAG_MIME, paletteToken);
  if (editorKey) event.dataTransfer.setData(`${TARGET_MIME_PREFIX}${editorKey.toLowerCase()}`, '');
  event.dataTransfer.effectAllowed = 'copy';
  setChipDragImage(event);
}

/** Checks the destination scope while native drag data is protected. */
export function paletteDragTargetsEditor(
  transfer: DataTransfer | null, editorKey: string, requireScope = false,
): boolean {
  const types = transfer?.types ?? [];
  return types.includes(CHIP_DRAG_MIME)
    && ((!requireScope && !types.some((type) => type.startsWith(TARGET_MIME_PREFIX)))
      || types.includes(`${TARGET_MIME_PREFIX}${editorKey.toLowerCase()}`));
}

/** Starts a move owned by one editor. Other editors cannot see its parked node key. */
export function startPlacedChipDrag(
  event: ReactDragEvent<HTMLElement>,
  dragKey: ChipDragKey,
  nodeKey: NodeKey,
  token: string,
): void {
  dragKey.current = nodeKey;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', token);
  setChipDragImage(event);
}
