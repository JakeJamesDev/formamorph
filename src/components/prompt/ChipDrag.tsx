import { useEffect } from 'react';
import {
  $getNodeByKey, $createRangeSelection, $setSelection, $insertNodes,
  COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_HIGH, DRAGOVER_COMMAND, DROP_COMMAND,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { $createVariableNode, $isVariableNode } from './VariableNode';
import { CHIP_DRAG_MIME, paletteDragTargetsEditor, type ChipDragKey } from './chipDragSource';

/**
 * Dropping chips into a field: an existing chip dragged to a new caret position within the same editor, and
 * a fresh one dragged in from the panel's palette.
 *
 * The two are told apart by where the payload is. A move parks the node key in `PromptDragContext` (only the
 * editor that owns the node can read it); a palette drag carries its token on the drag itself, so any chip
 * field it is dropped into can build the chip without knowing where it came from.
 */

/** Where the drop caret sits, across the two APIs browsers expose for it. */
function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

export function ChipDragPlugin({ dragKey, vocab, paletteScope = 'shared' }: {
  dragKey: ChipDragKey;
  paletteScope?: 'shared' | 'editor';
  /** Mints the placement id for a chip arriving from the palette. Omit to accept moves only. */
  vocab?: ChipVocabulary;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    // Browsers don't render a native drop caret when dragging our contenteditable=false chip, so we draw our
    // own: a thin vertical line positioned at the drop caret during dragover, hidden on drop / drag end.
    const caret = document.createElement('div');
    caret.dataset.chipDropCaret = '';
    caret.style.cssText =
      'position:fixed;width:2px;pointer-events:none;z-index:60;background:hsl(var(--foreground));display:none';
    document.body.appendChild(caret);
    const hideCaret = () => { caret.style.display = 'none'; };
    const acceptsPaletteToken = (token: string) =>
      !!vocab && vocab.isKnown(token) && (!vocab.acceptsPaletteToken || vocab.acceptsPaletteToken(token));
    const dropRange = (event: DragEvent) => {
      const root = editor.getRootElement();
      const source = dragKey.current ? editor.getElementByKey(dragKey.current) : null;
      if (event.target instanceof Node && source?.contains(event.target)) return null;
      const range = caretRangeFromPoint(event.clientX, event.clientY);
      if (!range || !root?.contains(range.startContainer) || source?.contains(range.startContainer)) return null;
      return range;
    };
    const showCaretAt = (range: Range) => {
      let rect = range.getBoundingClientRect();
      // Element boundaries have no caret box; adjacent inline content supplies the line geometry.
      if (!rect.height && range.startContainer instanceof Element) {
        const next = range.startContainer.childNodes[range.startOffset];
        const previous = range.startContainer.childNodes[range.startOffset - 1];
        if (next instanceof HTMLElement) {
          rect = next.getClientRects()[0] ?? rect;
        } else if (previous instanceof HTMLElement && !(previous instanceof HTMLBRElement)) {
          const last = [...previous.getClientRects()].at(-1);
          if (last) rect = new DOMRect(last.right, last.top, 0, last.height);
        }
      }
      if (!rect.height) return hideCaret();
      caret.style.left = `${rect.left}px`;
      caret.style.top = `${rect.top}px`;
      caret.style.height = `${rect.height}px`;
      caret.style.display = 'block';
    };
    // During dragover the payload is unreadable (by design), but its type list is not — which is exactly
    // enough to decide whether this field will take the drop.
    const carriesPaletteChip = (e: DragEvent) => !!vocab
      && paletteDragTargetsEditor(e.dataTransfer, editor.getKey(), paletteScope === 'editor');

    const removeOver = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event: DragEvent) => {
        const external = carriesPaletteChip(event);
        if (!dragKey.current && !external) return false;
        event.preventDefault(); // allow the drop
        const range = dropRange(event);
        if (!range) {
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
          hideCaret();
          return true;
        }
        if (event.dataTransfer) event.dataTransfer.dropEffect = external ? 'copy' : 'move';
        showCaretAt(range);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const removeDrop = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const key = dragKey.current;
        const payload = carriesPaletteChip(event) ? event.dataTransfer?.getData(CHIP_DRAG_MIME) ?? '' : '';
        const paletteToken = acceptsPaletteToken(payload) ? payload : '';
        if (!key && !paletteToken) {
          hideCaret();
          return false;
        }
        event.preventDefault();
        const range = dropRange(event);
        dragKey.current = null;
        hideCaret();
        if (!range) return true;
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.applyDOMRange(range);
          if (paletteToken && vocab) {
            $setSelection(selection);
            $insertNodes([$createVariableNode(vocab.freshInsertToken(paletteToken))]);
            return;
          }
          const node = key ? $getNodeByKey(key) : null;
          if (!$isVariableNode(node)) return;
          const token = node.getToken();
          if (selection.anchor.getNode().getKey() === key) return; // dropped onto itself
          // Removing the source must update the destination's child offset too.
          $setSelection(selection);
          node.remove();
          $insertNodes([$createVariableNode(token)]);
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    // dragend fires even when the drag is canceled or dropped outside the editor, so the caret never lingers.
    // Clear the parked node key too, or a canceled/outside drop leaves it set and the next unrelated drag
    // (text, a file) satisfies the dragover guard and gets treated as a continued chip move.
    const onDragEnd = () => {
      hideCaret();
      dragKey.current = null;
    };
    const onDocumentDragOver = (event: DragEvent) => {
      if (!(event.target instanceof Node) || !editor.getRootElement()?.contains(event.target)) hideCaret();
    };
    document.addEventListener('dragover', onDocumentDragOver, true);
    document.addEventListener('dragend', onDragEnd);
    return () => {
      removeOver();
      removeDrop();
      document.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('dragover', onDocumentDragOver, true);
      caret.remove();
    };
  }, [editor, dragKey, vocab, paletteScope]);
  return null;
}
