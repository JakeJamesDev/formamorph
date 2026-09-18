import type { LexicalEditor } from 'lexical';

/**
 * Calls `left` once focus has gone from the editor, and hands back the teardown.
 *
 * A value's blur never reaches the editor's blur command, so focus leaving is read from the root's own
 * `focusout`. The check waits a microtask, because the element taking focus next has not taken it yet when
 * the event fires — and focus moving within the editor is not a blur.
 */
export function registerEditorFocusOut(editor: LexicalEditor, left: () => void): () => void {
  const root = () => editor.getRootElement();
  const onFocusOut = () => queueMicrotask(() => {
    if (!root()?.contains(document.activeElement)) left();
  });
  const unroot = editor.registerRootListener((next, prev) => {
    prev?.removeEventListener('focusout', onFocusOut);
    next?.addEventListener('focusout', onFocusOut);
  });
  return () => {
    unroot();
    root()?.removeEventListener('focusout', onFocusOut);
  };
}
