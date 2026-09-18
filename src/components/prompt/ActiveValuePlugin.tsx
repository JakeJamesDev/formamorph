import { useEffect } from 'react';
import { $getSelection } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $caretChipKey } from './openValueCopies';
import { registerEditorFocusOut } from './editorFocusOut';
import type { ActiveValueRelay } from './openValueContext';

/**
 * Clears the header press that makes a value active. The press survives while the caret stays put, so a
 * value that cannot take one — a mirror, a locked value, a read-only field — keeps its active header.
 * A caret moved anywhere but into the pressed value ends it, and so does a press elsewhere in the field
 * and focus leaving the editor.
 */
export function ActiveValuePlugin({ relay }: { relay: ActiveValueRelay }) {
  const [editor] = useLexicalComposerContext();
  const { pressed, clear } = relay;
  useEffect(() => {
    if (pressed === null) return;
    const unregister = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      const [next, prev] = [editorState, prevEditorState].map((state) => state.read($getSelection));
      if (next === prev || (next && prev && next.is(prev))) return;
      if (editorState.read($caretChipKey) !== pressed) clear();
    });
    // A press in the field text ends the mark even where the caret lands back on the offset it already
    // held, which moves no selection for the listener above to read. A header answers for itself.
    const onPointerDown = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-open-value-header]')) clear();
    };
    const unroot = editor.registerRootListener((next, prev) => {
      prev?.removeEventListener('mousedown', onPointerDown);
      next?.addEventListener('mousedown', onPointerDown);
    });
    const unfocus = registerEditorFocusOut(editor, clear);
    return () => {
      unregister();
      unroot();
      editor.getRootElement()?.removeEventListener('mousedown', onPointerDown);
      unfocus();
    };
  }, [editor, pressed, clear]);
  return null;
}
