/**
 * Undo and redo over one immutable value. The history holds the values around the current one; the caller
 * keeps the current value. A run of edits that share a group is one step, until the step closes.
 */
export interface History<T> {
  readonly past: readonly T[];
  readonly future: readonly T[];
  /** The group of the open step, which the next edit with the same group joins. */
  readonly group: string | null;
}

export const EMPTY_HISTORY: History<never> = { past: [], future: [], group: null };

export const canUndo = (history: History<unknown>): boolean => history.past.length > 0;
export const canRedo = (history: History<unknown>): boolean => history.future.length > 0;

/**
 * Records an edit of `before`, the value the edit replaces. An edit with the open step's group joins that
 * step. Any edit drops the redo stack.
 */
export function pushHistory<T>(history: History<T>, before: T, group: string | null): History<T> {
  if (group !== null && group === history.group) return { ...history, future: [] };
  return { past: [...history.past, before], future: [], group };
}

/** Ends the open step, so the next edit starts a new one. */
export const closeHistoryStep = <T>(history: History<T>): History<T> => (history.group === null ? history : { ...history, group: null });

export interface HistoryStep<T> {
  readonly history: History<T>;
  /** The value to make current. */
  readonly value: T;
}

/** One step back from `current`, or null at the start. */
export function undoHistory<T>(history: History<T>, current: T): HistoryStep<T> | null {
  if (!canUndo(history)) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, current], group: null },
    value: history.past[history.past.length - 1],
  };
}

/** One step forward from `current`, or null at the end. */
export function redoHistory<T>(history: History<T>, current: T): HistoryStep<T> | null {
  if (!canRedo(history)) return null;
  return {
    history: { past: [...history.past, current], future: history.future.slice(0, -1), group: null },
    value: history.future[history.future.length - 1],
  };
}
