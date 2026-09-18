import { useEffect } from 'react';
import { $getSelection } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $caretChipKey } from './openValueCopies';
import type { ActiveValueRelay } from './openValueContext';

/**
 * Clears the header press that makes a value active. The press survives while the caret stays put, so a
 * value that cannot take one — a mirror, a locked value, a read-only field — keeps its active header.
 * Moving the caret anywhere but into the pressed value ends it, and so does focus leaving the editor.
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
    // A value's blur never reaches the editor's blur command, so focus leaving the editor is read here.
    const root = () => editor.getRootElement();
    const onFocusOut = () => queueMicrotask(() => {
      if (!root()?.contains(document.activeElement)) clear();
    });
    const unroot = editor.registerRootListener((next, prev) => {
      prev?.removeEventListener('focusout', onFocusOut);
      next?.addEventListener('focusout', onFocusOut);
    });
    return () => {
      unregister();
      unroot();
      root()?.removeEventListener('focusout', onFocusOut);
    };
  }, [editor, pressed, clear]);
  return null;
}
