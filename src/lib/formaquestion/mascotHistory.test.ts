import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY, canRedo, canUndo, closeHistoryStep, pushHistory, redoHistory, undoHistory, type History,
} from './mascotHistory';

/** Records each value in turn as one step, the way an edit pushes the value it replaces. */
const record = (values: readonly number[], group: string | null = null): History<number> =>
  values.slice(0, -1).reduce<History<number>>((history, value) => pushHistory(history, value, group), EMPTY_HISTORY);

describe('mascot history', () => {
  it('starts with nothing to undo or redo', () => {
    expect(canUndo(EMPTY_HISTORY)).toBe(false);
    expect(canRedo(EMPTY_HISTORY)).toBe(false);
    expect(undoHistory(EMPTY_HISTORY, 0)).toBeNull();
    expect(redoHistory(EMPTY_HISTORY, 0)).toBeNull();
  });

  it('undoes step by step, back to the first value', () => {
    // Values 1, 2, 3: two edits, current is 3.
    let history = record([1, 2, 3]);
    let step = undoHistory(history, 3)!;
    expect(step.value).toBe(2);
    step = undoHistory(step.history, step.value)!;
    expect(step.value).toBe(1);
    expect(canUndo(step.history)).toBe(false);
    history = step.history;
    expect(undoHistory(history, 1)).toBeNull();
  });

  it('redoes what an undo stepped back over', () => {
    const undone = undoHistory(record([1, 2, 3]), 3)!;
    expect(canRedo(undone.history)).toBe(true);
    const redone = redoHistory(undone.history, undone.value)!;
    expect(redone.value).toBe(3);
    expect(canRedo(redone.history)).toBe(false);
    expect(canUndo(redone.history)).toBe(true);
  });

  it('drops the redo stack when an edit follows an undo', () => {
    const undone = undoHistory(record([1, 2, 3]), 3)!;
    const branched = pushHistory(undone.history, undone.value, null);
    expect(canRedo(branched)).toBe(false);
    // Undo now returns to 2, then 1: the old 3 is gone.
    const first = undoHistory(branched, 9)!;
    expect(first.value).toBe(2);
    expect(undoHistory(first.history, first.value)!.value).toBe(1);
  });

  it('folds a run of edits with one group into one step', () => {
    // A drag: 1 -> 2 -> 3 -> 4 under one group.
    const history = record([1, 2, 3, 4], 'slider');
    const step = undoHistory(history, 4)!;
    expect(step.value).toBe(1);
    expect(canUndo(step.history)).toBe(false);
  });

  it('starts a new step when the group changes', () => {
    let history: History<number> = pushHistory(EMPTY_HISTORY, 1, 'voice');
    history = pushHistory(history, 2, 'jelly');
    expect(undoHistory(history, 3)!.value).toBe(2);
  });

  it('starts a new step after a closed group, even with the same group', () => {
    let history: History<number> = pushHistory(EMPTY_HISTORY, 1, 'slider');
    history = pushHistory(history, 2, 'slider');
    history = closeHistoryStep(history);
    history = pushHistory(history, 3, 'slider');
    const first = undoHistory(history, 4)!;
    expect(first.value).toBe(3);
    expect(undoHistory(first.history, first.value)!.value).toBe(1);
  });

  it('never folds an ungrouped edit into the step before it', () => {
    let history: History<number> = pushHistory(EMPTY_HISTORY, 1, null);
    history = pushHistory(history, 2, null);
    expect(undoHistory(history, 3)!.value).toBe(2);
  });

  it('closes the open step on undo, so the next edit is its own step', () => {
    let history: History<number> = pushHistory(EMPTY_HISTORY, 1, 'slider');
    history = pushHistory(history, 2, 'slider');
    const undone = undoHistory(history, 3)!;
    const redone = redoHistory(undone.history, undone.value)!;
    const next = pushHistory(redone.history, redone.value, 'slider');
    const first = undoHistory(next, 4)!;
    expect(first.value).toBe(3);
  });
});
