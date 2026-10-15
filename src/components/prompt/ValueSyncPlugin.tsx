import { useEffect, useRef, useState } from 'react';
import { HISTORY_MERGE_TAG } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { buildEditorState, createEchoLedger, serializeRoot } from './promptFieldState';
import { useWorldValueSync } from './useWorldValueSync';

/** Two-way sync between the controlled `value` string and the Lexical editor state. Our own edits go through
 *  the echo ledger, so the external-value effect never rebuilds (and jolts the caret) on an echo. */
export function ValueSyncPlugin({ value, onChange, parse, onExternalValue }: {
  value: string;
  onChange: (v: string) => void;
  parse: ChipVocabulary['parse'];
  /** Fired when `value` changes from outside the editor (a Reset or a template swap), not on a typed echo. */
  onExternalValue?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [echoes] = useState(() => createEchoLedger(value));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const onExternalRef = useRef(onExternalValue);
  onExternalRef.current = onExternalValue;

  // Whether a person has done anything since this field mounted. A value that arrives on its own — a world
  // still loading, a draft resolving — is not an edit and must not become an undo step, or a freshly opened
  // editor offers to "undo" back to the empty field it rendered for one tick. A generation, a Reset or a
  // template swap all follow a click, which is what tells them apart: by shape they are the same change.
  const userActed = useRef(false);
  useEffect(() => {
    const mark = () => { userActed.current = true; };
    const doc = editor.getRootElement()?.ownerDocument ?? document;
    doc.addEventListener('pointerdown', mark, { capture: true });
    doc.addEventListener('keydown', mark, { capture: true });
    return () => {
      doc.removeEventListener('pointerdown', mark, { capture: true });
      doc.removeEventListener('keydown', mark, { capture: true });
    };
  }, [editor]);

  const { markWrite, restoreTags } = useWorldValueSync();
  useEffect(() => {
    if (echoes.receive(value)) return;
    // The merge tag folds the rebuild into the current history entry instead of pushing one.
    const tag = restoreTags(value) ?? (userActed.current ? undefined : HISTORY_MERGE_TAG);
    editor.update(() => buildEditorState(value, parseRef.current), tag ? { tag } : undefined);
    onExternalRef.current?.();
  }, [value, editor, echoes, restoreTags]);

  useEffect(
    () => editor.registerUpdateListener(({ editorState, tags }) => {
      editorState.read(() => {
        const next = serializeRoot();
        if (!echoes.send(next)) return;
        markWrite(tags);
        onChangeRef.current(next);
      });
    }),
    [editor, echoes, markWrite],
  );
  return null;
}

/** Reflects `readOnly` into the editor's editability (initialConfig only applies it at mount). */
export function EditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(!readOnly), [editor, readOnly]);
  return null;
}
