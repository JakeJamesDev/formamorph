import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $addUpdateTag, $createParagraphNode, $createRangeSelectionFromDom, $getSelection, $isRangeSelection, $setSelection, COMMAND_PRIORITY_HIGH, PASTE_COMMAND, PASTE_TAG } from 'lexical';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { appendSegments } from './promptFieldState';

/** Restore serialized prompt placements from the plain-text clipboard. */
export function PromptTokenPastePlugin({ vocab }: { vocab: ChipVocabulary }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerCommand(PASTE_COMMAND, event => {
    if (!editor.isEditable() || !event || !('clipboardData' in event)) return false;
    const text = event.clipboardData?.getData('text/plain');
    if (!text || !vocab.parse(text).some(segment => segment.type === 'variable')) return false;
    const root = editor.getRootElement();
    const domSelection = root?.ownerDocument.getSelection();
    // Keyboard caret movement can precede Lexical's selectionchange update.
    const selection = domSelection && root?.contains(domSelection.anchorNode) && root.contains(domSelection.focusNode)
      ? $createRangeSelectionFromDom(domSelection, editor) : $getSelection();
    if (!$isRangeSelection(selection)) return false;
    $setSelection(selection);
    event.preventDefault();
    const paragraph = $createParagraphNode();
    appendSegments(paragraph, text, vocab.parse);
    selection.insertNodes(paragraph.getChildren());
    $addUpdateTag(PASTE_TAG);
    return true;
  }, COMMAND_PRIORITY_HIGH), [editor, vocab]);
  return null;
}
