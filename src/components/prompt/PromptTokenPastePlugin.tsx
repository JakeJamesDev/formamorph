import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $addUpdateTag, $createParagraphNode, $createRangeSelectionFromDom, $getSelection, $isRangeSelection, $setSelection,
  COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_HIGH, PASTE_COMMAND, PASTE_TAG, type LexicalEditor, type RangeSelection,
} from 'lexical';
import { blueprintChipsRemovedNotice } from '@/lib/blueprintChips';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { appendSegments } from './promptFieldState';

/** Where a paste lands. Keyboard caret movement can precede Lexical's selectionchange update, so the DOM's
 *  selection wins while it sits inside the editor. */
function $pasteSelection(editor: LexicalEditor): RangeSelection | null {
  const root = editor.getRootElement();
  const domSelection = root?.ownerDocument.getSelection();
  const selection = domSelection && root?.contains(domSelection.anchorNode) && root.contains(domSelection.focusNode)
    ? $createRangeSelectionFromDom(domSelection, editor) : $getSelection();
  if (!$isRangeSelection(selection)) return null;
  $setSelection(selection);
  return selection;
}

/** Restore serialized prompt placements from the plain-text clipboard. */
export function PromptTokenPastePlugin({ vocab }: { vocab: ChipVocabulary }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerCommand(PASTE_COMMAND, event => {
    if (!editor.isEditable() || !event || !('clipboardData' in event)) return false;
    const text = event.clipboardData?.getData('text/plain');
    if (!text || !vocab.parse(text).some(segment => segment.type === 'variable')) return false;
    const selection = $pasteSelection(editor);
    if (!selection) return false;
    event.preventDefault();
    const paragraph = $createParagraphNode();
    appendSegments(paragraph, text, vocab.parse);
    selection.insertNodes(paragraph.getChildren());
    $addUpdateTag(PASTE_TAG);
    return true;
  }, COMMAND_PRIORITY_HIGH), [editor, vocab]);
  return null;
}

/**
 * Drop the chips this field refuses from a plain-text paste, and say so. The rest pastes as the field takes
 * it: chips restored where the field restores them, raw text elsewhere.
 */
export function RefusedChipPastePlugin({ vocab }: { vocab: ChipVocabulary }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerCommand(PASTE_COMMAND, event => {
    const refuses = vocab.refuses;
    if (!refuses || !editor.isEditable() || !event || !('clipboardData' in event)) return false;
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return false;
    let dropped = 0;
    const kept = vocab.parse(text).map((segment) => {
      if (segment.type === 'text') return segment.value;
      if (!refuses(segment.token)) return segment.token;
      dropped += 1;
      return '';
    }).join('');
    if (!dropped) return false;
    const selection = $pasteSelection(editor);
    if (!selection) return false;
    event.preventDefault();
    if (vocab.header) {
      const paragraph = $createParagraphNode();
      appendSegments(paragraph, kept, vocab.parse);
      selection.insertNodes(paragraph.getChildren());
    } else {
      selection.insertRawText(kept);
    }
    $addUpdateTag(PASTE_TAG);
    toast.info(blueprintChipsRemovedNotice(dropped, 'paste'));
    return true;
  }, COMMAND_PRIORITY_CRITICAL), [editor, vocab]);
  return null;
}
