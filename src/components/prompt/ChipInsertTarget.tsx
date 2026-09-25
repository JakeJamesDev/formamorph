/* eslint-disable react-refresh/only-export-components -- this module co-locates the insert-target context,
   its provider/registrar components, and the shared caret-insert helper; they are one unit. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  $getRoot, $getSelection, $isRangeSelection, $isElementNode, $createParagraphNode,
  UNDO_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { $createVariableNode } from './VariableNode';
import { startPaletteChipDrag } from './chipDragSource';

/**
 * Which chip field a shared palette inserts into. One palette serves every field in a panel, so it needs a
 * target: the field holding the caret. A completed palette click runs before the delayed focus departure
 * clears that claim, then insertion returns focus to the field.
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
  /** True where the claimed field takes this palette token, so a palette can hold back what it refuses. */
  accepts: ((paletteToken: string) => boolean) | null;
  /** `root` is the field's editable element, used to tell focus moving *within* the field from focus
   *  leaving it for something that can't take a chip. */
  claim: (key: symbol, field: ClaimedField, root: HTMLElement | null) => void;
  /** Drops the claim only if `key` still holds it, so a field unmounting can't steal focus from its successor. */
  release: (key: symbol) => void;
}

export interface ChipInsertRegistration {
  /** Does nothing for a token the field does not accept. */
  insert: (paletteToken: string) => void;
  startDrag: (event: DragEvent<HTMLElement>, paletteToken: string) => void;
  undo: () => void;
  ownerId: string | null;
  accepts: (paletteToken: string) => boolean;
}

/** What a field hands the shared target when it claims it. */
export type ClaimedField = Pick<ChipInsertRegistration, 'insert' | 'undo' | 'ownerId'>
  & Partial<Pick<ChipInsertRegistration, 'accepts'>>;

const ChipInsertTargetContext = createContext<TargetState>({
  insert: null, undo: null, ownerId: null, accepts: null, claim: () => {}, release: () => {},
});

export function useChipInsertTarget(): TargetState {
  return useContext(ChipInsertTargetContext);
}

/** Registers one editor's existing insertion and history behavior for any palette source. */
export function useChipInsertRegistration(vocab: ChipVocabulary, ownerId?: string): ChipInsertRegistration {
  const [editor] = useLexicalComposerContext();
  const vocabRef = useRef(vocab);
  vocabRef.current = vocab;
  // The same test a drop into the field passes.
  const accepts = useCallback((token: string) => {
    const v = vocabRef.current;
    return v.isKnown(token) && (v.acceptsPaletteToken?.(token) ?? true);
  }, []);
  const insert = useCallback(
    (token: string) => { if (accepts(token)) insertChipAtCaret(editor, vocabRef.current, token); },
    [editor, accepts],
  );
  const undo = useCallback(() => { editor.dispatchCommand(UNDO_COMMAND, undefined); }, [editor]);
  const startDrag = useCallback(
    (event: DragEvent<HTMLElement>, token: string) => startPaletteChipDrag(event, token, editor.getKey()),
    [editor],
  );
  return useMemo(
    () => ({ insert, startDrag, undo, ownerId: ownerId ?? null, accepts }),
    [insert, startDrag, undo, ownerId, accepts],
  );
}

/** Marks a shared palette, whose press keeps the claimed field's target until the click completes. */
export const CHIP_PALETTE_ATTR = 'data-chip-palette';

/** Wraps a panel so every chip field inside it shares one insert target. */
export function ChipInsertTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ key: symbol; field: ClaimedField } | null>(null);
  const holder = useRef<symbol | null>(null);
  const holderRoot = useRef<HTMLElement | null>(null);

  const claim = useCallback((key: symbol, field: ClaimedField, root: HTMLElement | null) => {
    holder.current = key;
    holderRoot.current = root;
    setTarget({ key, field });
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
  // Deliberately waits past the click: a palette press takes focus at pointer-down, and its click comes only
  // at release. The palette cannot keep focus with `preventDefault`, which would cancel its native drag.
  useEffect(() => {
    let palettePress = false;
    const settle = () => {
      if (!holder.current || palettePress) return;
      if (holderRoot.current?.contains(document.activeElement)) return;
      holder.current = null;
      holderRoot.current = null;
      setTarget(null);
    };
    // Settled on the next tick rather than read from `relatedTarget`: a chip editor hands focus around
    // inside itself while restoring its selection, and each of those blurs reports going nowhere. Asking
    // where focus actually landed, once it has landed, tells a real departure from that shuffle — and
    // covers focus falling to nothing at all, which reports no incoming element either way.
    const onFocusOut = () => { if (holder.current) setTimeout(settle, 0); };
    const onPointerDown = (event: PointerEvent) => {
      palettePress = event.target instanceof Element && event.target.closest(`[${CHIP_PALETTE_ATTR}]`) !== null;
    };
    // A release or a drag ends the press; the click that follows it runs before this settles.
    const onPointerEnd = () => {
      if (!palettePress) return;
      palettePress = false;
      setTimeout(settle, 0);
    };
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    return () => {
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerEnd, true);
      document.removeEventListener('pointercancel', onPointerEnd, true);
    };
  }, []);

  const value = useMemo<TargetState>(
    () => ({
      insert: target?.field.insert ?? null,
      undo: target?.field.undo ?? null,
      ownerId: target?.field.ownerId ?? null,
      accepts: target?.field.accepts ?? null,
      claim,
      release,
    }),
    [target, claim, release],
  );

  return <ChipInsertTargetContext.Provider value={value}>{children}</ChipInsertTargetContext.Provider>;
}

/**
 * Claims the shared insert target for this editor while it holds focus. The provider releases the claim
 * after a completed outside click or when the field unmounts.
 */
export function ChipInsertTargetPlugin({ vocab, ownerId }: {
  vocab: ChipVocabulary;
  /** See `TargetState.ownerId`. */
  ownerId?: string;
}) {
  const [editor] = useLexicalComposerContext();
  const { claim, release } = useChipInsertTarget();
  const registration = useChipInsertRegistration(vocab, ownerId);
  // Identity for this field instance, so a later unmount only clears a claim it still owns.
  const key = useMemo(() => Symbol('chip-field'), []);
  useEffect(() => {
    const take = () => claim(key, registration, editor.getRootElement());
    // A DOM focusin listener on the root rather than Lexical's FOCUS_COMMAND: the command is dispatched by
    // the text plugin's own handler and does not fire for every route into the field (a programmatic focus,
    // or a click that lands on a chip decorator rather than the text). focusin bubbles from all of them.
    return editor.registerRootListener((root, prevRoot) => {
      prevRoot?.removeEventListener('focusin', take);
      root?.addEventListener('focusin', take);
      if (root?.contains(document.activeElement)) take();
    });
  }, [editor, claim, key, registration]);

  useEffect(() => () => release(key), [release, key]);

  return null;
}
