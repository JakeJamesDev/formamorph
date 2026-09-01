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
 * target: the field holding the caret, which keeps its claim across the palette click itself because that
 * click never takes focus (the palette calls `preventDefault` on mouse-down).
 *
 * The claim ends the moment the caret leaves the field, rather than lingering with whichever field held it
 * last. Lingering made every palette chip live at all times, which cost the chips their own gestures —
 * double-clicking one to rename it fired an insert into a field the author had long since left.
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
  /** The placeholder whose own values the claimed field edits, when it is one — what a palette reads to
   *  leave out the chips that would loop back into it. Null for a field outside any placeholder. */
  ownerId: string | null;
  /** `root` is the field's editable element, used to tell focus moving *within* the field from focus
   *  leaving it for something that can't take a chip. */
  claim: (
    key: symbol, fn: (paletteToken: string) => void, undo: () => void, root: HTMLElement | null, ownerId?: string,
  ) => void;
  /** Drops the claim only if `key` still holds it, so a field unmounting can't steal focus from its successor. */
  release: (key: symbol) => void;
}

const ChipInsertTargetContext = createContext<TargetState>({
  insert: null, undo: null, ownerId: null, claim: () => {}, release: () => {},
});

export function useChipInsertTarget(): TargetState {
  return useContext(ChipInsertTargetContext);
}

/** Wraps a panel so every chip field inside it shares one insert target. */
export function ChipInsertTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{
    key: symbol; insert: (t: string) => void; undo: () => void; ownerId: string | null;
  } | null>(null);
  const holder = useRef<symbol | null>(null);
  const holderRoot = useRef<HTMLElement | null>(null);

  const claim = useCallback((
    key: symbol, insert: (t: string) => void, undo: () => void, root: HTMLElement | null, ownerId?: string,
  ) => {
    holder.current = key;
    holderRoot.current = root;
    setTarget({ key, insert, undo, ownerId: ownerId ?? null });
  }, []);

  const release = useCallback((key: symbol) => {
    if (holder.current !== key) return;
    holder.current = null;
    holderRoot.current = null;
    setTarget(null);
  }, []);

  // Drop the claim as soon as the caret leaves the field. `focusout` rather than `focusin`, because focus
  // falling to nothing at all — clicking blank panel background — fires no `focusin` and would otherwise
  // leave the palette lit with no caret to insert at.
  //
  // Deliberately ignores a `relatedTarget` that cannot hold focus: the palette's own mouse-down prevents
  // the default focus change, so the click that inserts never reaches here.
  useEffect(() => {
    const onFocusOut = () => {
      if (!holder.current) return;
      // Settled on the next tick rather than read from `relatedTarget`: a chip editor hands focus around
      // inside itself while restoring its selection, and each of those blurs reports going nowhere. Asking
      // where focus actually landed, once it has landed, tells a real departure from that shuffle — and
      // covers focus falling to nothing at all, which reports no incoming element either way.
      setTimeout(() => {
        if (!holder.current) return;
        if (holderRoot.current?.contains(document.activeElement)) return;
        holder.current = null;
        holderRoot.current = null;
        setTarget(null);
      }, 0);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, []);

  const value = useMemo<TargetState>(
    () => ({
      insert: target?.insert ?? null, undo: target?.undo ?? null, ownerId: target?.ownerId ?? null, claim, release,
    }),
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
export function ChipInsertTargetPlugin({ vocab, ownerId }: {
  vocab: ChipVocabulary;
  /** See `TargetState.ownerId`. */
  ownerId?: string;
}) {
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
      ownerId,
    );
    // A DOM focusin listener on the root rather than Lexical's FOCUS_COMMAND: the command is dispatched by
    // the text plugin's own handler and does not fire for every route into the field (a programmatic focus,
    // or a click that lands on a chip decorator rather than the text). focusin bubbles from all of them.
    return editor.registerRootListener((root, prevRoot) => {
      prevRoot?.removeEventListener('focusin', take);
      root?.addEventListener('focusin', take);
      if (root?.contains(document.activeElement)) take();
    });
  }, [editor, claim, key, ownerId]);

  useEffect(() => () => release(key), [release, key]);

  return null;
}
