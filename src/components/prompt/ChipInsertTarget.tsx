/* eslint-disable react-refresh/only-export-components -- this module co-locates the insert-target context,
   its provider/registrar components, and the shared caret-insert helper; they are one unit. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  $getRoot, $getSelection, $isRangeSelection, $isElementNode, $createParagraphNode,
  type LexicalEditor,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { $createVariableNode } from './VariableNode';

/**
 * Which chip field a shared palette inserts into. One palette serves every field in a panel, so it needs a
 * target: the field that most recently held focus keeps the claim even after the palette itself is clicked,
 * which is what lets a click on a chip land where the author was last typing.
 */

/** Drop a fresh chip at the caret, or at the end of the field when it has no selection yet. */
export function insertChipAtCaret(editor: LexicalEditor, vocab: ChipVocabulary, paletteToken: string): void {
  editor.update(() => {
    const node = $createVariableNode(vocab.freshInsertToken(paletteToken));
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.insertNodes([node]);
      return;
    }
    const root = $getRoot();
    const last = root.getLastChild();
    if ($isElementNode(last)) last.append(node);
    else {
      const para = $createParagraphNode();
      para.append(node);
      root.append(para);
    }
  });
  editor.focus();
}

interface TargetState {
  insert: ((paletteToken: string) => void) | null;
  claim: (key: symbol, fn: (paletteToken: string) => void) => void;
  /** Drops the claim only if `key` still holds it, so a field unmounting can't steal focus from its successor. */
  release: (key: symbol) => void;
}

const ChipInsertTargetContext = createContext<TargetState>({ insert: null, claim: () => {}, release: () => {} });

export function useChipInsertTarget(): TargetState {
  return useContext(ChipInsertTargetContext);
}

/** Wraps a panel so every chip field inside it shares one insert target. */
export function ChipInsertTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ key: symbol; insert: (t: string) => void } | null>(null);
  const holder = useRef<symbol | null>(null);

  const claim = useCallback((key: symbol, insert: (t: string) => void) => {
    holder.current = key;
    setTarget({ key, insert });
  }, []);

  const release = useCallback((key: symbol) => {
    if (holder.current !== key) return;
    holder.current = null;
    setTarget(null);
  }, []);

  const value = useMemo<TargetState>(
    () => ({ insert: target?.insert ?? null, claim, release }),
    [target, claim, release],
  );

  return <ChipInsertTargetContext.Provider value={value}>{children}</ChipInsertTargetContext.Provider>;
}

/**
 * Claims the shared insert target for this editor while it holds focus. Deliberately does not release on
 * blur — the palette lives outside the field, so clicking it necessarily blurs; keeping the claim is what
 * makes the click land. The claim is only dropped when the field unmounts.
 */
export function ChipInsertTargetPlugin({ vocab }: { vocab: ChipVocabulary }) {
  const [editor] = useLexicalComposerContext();
  const { claim, release } = useChipInsertTarget();
  // Identity for this field instance, so a later unmount only clears a claim it still owns.
  const key = useMemo(() => Symbol('chip-field'), []);
  const vocabRef = useRef(vocab);
  vocabRef.current = vocab;

  useEffect(() => {
    const take = () => claim(key, (token) => insertChipAtCaret(editor, vocabRef.current, token));
    // A DOM focusin listener on the root rather than Lexical's FOCUS_COMMAND: the command is dispatched by
    // the text plugin's own handler and does not fire for every route into the field (a programmatic focus,
    // or a click that lands on a chip decorator rather than the text). focusin bubbles from all of them.
    return editor.registerRootListener((root, prevRoot) => {
      prevRoot?.removeEventListener('focusin', take);
      root?.addEventListener('focusin', take);
      if (root?.contains(document.activeElement)) take();
    });
  }, [editor, claim, key]);

  useEffect(() => () => release(key), [release, key]);

  return null;
}
