import { useEffect, useMemo } from 'react';
import { CLEAR_HISTORY_COMMAND, type LexicalEditor } from 'lexical';
import { HistoryPlugin, createEmptyHistoryState, type HistoryState } from '@lexical/react/LexicalHistoryPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { registerFieldUndo } from '@/lib/fieldUndo';
import { WORLD_RESTORE_TAG } from './useWorldValueSync';

/** Registers the field's root with what its history can undo while the field is editable. */
function useFieldUndoReport(editor: LexicalEditor, historyState: HistoryState) {
  useEffect(() => {
    let unregister = () => {};
    const stop = editor.registerRootListener((root) => {
      unregister();
      unregister = root ? registerFieldUndo(root, {
        canUndo: () => editor.isEditable() && historyState.undoStack.length > 0,
        canRedo: () => editor.isEditable() && historyState.redoStack.length > 0,
      }) : () => {};
    });
    return () => { stop(); unregister(); };
  }, [editor, historyState]);
}

/**
 * Lexical's history, seeded with the mounted state as an entry to undo to, and reported to the editor's chord
 * listener so the field takes a press it can use. Unseeded, the first change becomes the baseline: a first
 * whole-value replace (Generate, a Reset) has nothing to undo, and the field's history runs out before the
 * text is back where the field opened.
 */
export function FieldHistoryPlugin() {
  const [editor] = useLexicalComposerContext();
  const historyState = useMemo(() => createEmptyHistoryState(), []);
  // In an effect, not in render: during render the initial state is still pending, so what's readable is the
  // bare root, and `setEditorState` rejects an empty state, which makes undoing to it a silent no-op.
  useEffect(() => {
    historyState.current ??= { editor, editorState: editor.getEditorState() };
  }, [editor, historyState]);
  // The field's entries describe text the world has since moved away from, so a restore ends both stacks.
  useEffect(() => editor.registerUpdateListener(({ tags }) => {
    if (tags.has(WORLD_RESTORE_TAG)) editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
  }), [editor]);
  useFieldUndoReport(editor, historyState);
  return <HistoryPlugin externalHistoryState={historyState} />;
}
