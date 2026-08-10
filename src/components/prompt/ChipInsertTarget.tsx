/* eslint-disable react-refresh/only-export-components -- this module co-locates the insert-target context,
   its provider/registrar components, and the shared caret-insert helper; they are one unit. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  $getRoot, $getSelection, $isRangeSelection, $isElementNode, $createParagraphNode,
  UNDO_COMMAND,
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
function insertChipAtCaret(editor: LexicalEditor, vocab: ChipVocabulary, paletteToken: string): void {
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
  /** Take back the last insert, through the target field's own history — what Ctrl+Z there would do.
   *  Lets a gesture that begins with a click undo that click's effect once it turns out to be something
   *  else (double-clicking a palette chip to rename it). */
  undo: (() => void) | null;
  /** `root` is the field's editable element, used to tell focus moving *within* the field from focus
   *  leaving it for something that can't take a chip. */
  claim: (key: symbol, fn: (paletteToken: string) => void, undo: () => void, root: HTMLElement | null) => void;
  /** Drops the claim only if `key` still holds it, so a field unmounting can't steal focus from its successor. */
  release: (key: symbol) => void;
}

const ChipInsertTargetContext = createContext<TargetState>({ insert: null, undo: null, claim: () => {}, release: () => {} });

export function useChipInsertTarget(): TargetState {
  return useContext(ChipInsertTargetContext);
}

/** Wraps a panel so every chip field inside it shares one insert target. */
export function ChipInsertTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ key: symbol; insert: (t: string) => void; undo: () => void } | null>(null);
  const holder = useRef<symbol | null>(null);
  const holderRoot = useRef<HTMLElement | null>(null);

  const claim = useCallback((key: symbol, insert: (t: string) => void, undo: () => void, root: HTMLElement | null) => {
    holder.current = key;
    holderRoot.current = root;
    setTarget({ key, insert, undo });
  }, []);

  const release = useCallback((key: symbol) => {
    if (holder.current !== key) return;
    holder.current = null;
    holderRoot.current = null;
    setTarget(null);
  }, []);

  // Drop the claim when the author moves to something a chip can't go into — a plain input, a textarea, a
  // number box. Without this the palette stays lit after clicking into an ordinary field and its chips would
  // land back in whichever chip field was focused last, which is not where the author is looking.
  //
  // Only a focused *editable* releases: clicking a button, a tab or the palette itself must not, since
  // reaching the palette necessarily moves focus off the field it is about to insert into.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !holder.current) return;
      if (holderRoot.current?.contains(el)) return; // still inside the claiming field
      const editable = el.isContentEditable
        || el.tagName === 'INPUT'
        || el.tagName === 'TEXTAREA';
      if (!editable) return;
      holder.current = null;
      holderRoot.current = null;
      setTarget(null);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const value = useMemo<TargetState>(
    () => ({ insert: target?.insert ?? null, undo: target?.undo ?? null, claim, release }),
    [target, claim, release],
  );

  return <ChipInsertTargetContext.Provider value={value}>{children}</ChipInsertTargetContext.Provider>;
}

/**
 * Claims the shared insert target for this editor while it holds focus. Deliberately does not release on
 * blur — the palette lives outside the field, so clicking it necessarily blurs; keeping the claim is what
 * makes the click land. The claim is dropped when the field unmounts, or when the provider sees focus land
 * in an ordinary text field that cannot hold a chip.
 */
export function ChipInsertTargetPlugin({ vocab }: { vocab: ChipVocabulary }) {
  const [editor] = useLexicalComposerContext();
  const { claim, release } = useChipInsertTarget();
  // Identity for this field instance, so a later unmount only clears a claim it still owns.
  const key = useMemo(() => Symbol('chip-field'), []);
  const vocabRef = useRef(vocab);
  vocabRef.current = vocab;

  useEffect(() => {
    const take = () => claim(
      key,
      (token) => insertChipAtCaret(editor, vocabRef.current, token),
      () => editor.dispatchCommand(UNDO_COMMAND, undefined),
      editor.getRootElement(),
    );
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
