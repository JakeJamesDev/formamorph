import { useCallback, useReducer, useRef } from 'react';
import {
  initHistory, commitHistory, undoHistory, redoHistory, canUndo, canRedo, type HistoryState,
} from '@/lib/textHistory';

/** The tags a comma-separated value actually holds, ignoring spacing and empty entries. */
function tokens(value: string): string[] {
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

/**
 * True when the change is the author still typing the tag they were already typing: same tags before it,
 * and the last one has only grown or shrunk from one end. A new tag, a removed one, or a rewrite of the
 * whole list is something else, and opens its own undo step.
 */
function stillTypingSameTag(before: string, after: string): boolean {
  const [x, y] = [tokens(before), tokens(after)];
  if (x.length !== y.length) return false;
  if (!x.slice(0, -1).every((t, i) => t === y[i])) return false;
  const [a, b] = [x[x.length - 1] ?? '', y[y.length - 1] ?? ''];
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Undo/redo for a comma-separated tag field, stepped by tag rather than by keystroke: adding or removing
 * one tag is one step, and so is a generation that rewrites the whole list. Keystrokes that leave the tag
 * list unchanged — typing the letters of a tag before its comma — fold into the step in progress.
 *
 * The value stays owned by the parent, so edits made in the field reach this through `value`.
 */
export function useTagHistory(value: string, onChange: (next: string) => void) {
  const snap = (v: string) => ({ value: v, selectionStart: 0, selectionEnd: 0 }); // selection unused here
  const historyRef = useRef<HistoryState>(initHistory(snap(value)));
  // The value our own undo/redo pushed out; anything else arriving is an edit to fold in.
  const ownRef = useRef(value);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  if (value !== ownRef.current) {
    historyRef.current = commitHistory(
      historyRef.current, snap(value), stillTypingSameTag(historyRef.current.present.value, value),
    );
    ownRef.current = value;
  }

  const move = useCallback((next: HistoryState) => {
    if (next === historyRef.current) return;
    historyRef.current = next;
    ownRef.current = next.present.value;
    onChange(next.present.value);
    forceUpdate();
  }, [onChange]);

  return {
    undo: useCallback(() => move(undoHistory(historyRef.current)), [move]),
    redo: useCallback(() => move(redoHistory(historyRef.current)), [move]),
    canUndo: canUndo(historyRef.current),
    canRedo: canRedo(historyRef.current),
  };
}
