// Pure undo/redo history for a text field. A controlled textarea breaks the browser's native undo
// once we insert markdown programmatically, so MarkdownField drives its own history through this
// reducer. Each snapshot carries the selection so undo/redo can restore the caret too.

export interface TextSnapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface HistoryState {
  past: TextSnapshot[];
  present: TextSnapshot;
  future: TextSnapshot[];
}

/** Cap the undo depth so a long editing session can't grow the stack without bound. */
const HISTORY_LIMIT = 100;

export function initHistory(present: TextSnapshot): HistoryState {
  return { past: [], present, future: [] };
}

/**
 * Commit a new snapshot. `coalesce` folds the change into the current present (continuous typing)
 * instead of opening a new undo step; otherwise the present is pushed onto the undo stack. Either way
 * the redo stack is cleared. A selection-only change (same value) never opens an undo step.
 */
export function commitHistory(state: HistoryState, next: TextSnapshot, coalesce: boolean): HistoryState {
  if (next.value === state.present.value) return { ...state, present: next };
  if (coalesce) return { ...state, present: next, future: [] };
  const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [] };
}

export function undoHistory(state: HistoryState): HistoryState {
  if (!state.past.length) return state;
  const present = state.past[state.past.length - 1];
  return { past: state.past.slice(0, -1), present, future: [state.present, ...state.future] };
}

export function redoHistory(state: HistoryState): HistoryState {
  if (!state.future.length) return state;
  const [present, ...future] = state.future;
  return { past: [...state.past, state.present], present, future };
}

export const canUndo = (state: HistoryState) => state.past.length > 0;
export const canRedo = (state: HistoryState) => state.future.length > 0;
