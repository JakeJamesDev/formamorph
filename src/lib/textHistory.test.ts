import { describe, it, expect } from 'vitest';
import {
  initHistory, commitHistory, undoHistory, redoHistory, canUndo, canRedo, type TextSnapshot,
} from './textHistory';

const snap = (value: string): TextSnapshot => ({ value, selectionStart: value.length, selectionEnd: value.length });

describe('textHistory', () => {
  it('starts with no undo/redo available', () => {
    const s = initHistory(snap('a'));
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it('opens a discrete undo step for a non-coalesced commit', () => {
    let s = initHistory(snap('a'));
    s = commitHistory(s, snap('ab'), false);
    expect(canUndo(s)).toBe(true);
    expect(s.present.value).toBe('ab');
    s = undoHistory(s);
    expect(s.present.value).toBe('a');
    expect(canRedo(s)).toBe(true);
  });

  it('folds coalesced commits into one undo step', () => {
    let s = initHistory(snap('a'));
    s = commitHistory(s, snap('ab'), false); // first keystroke: discrete
    s = commitHistory(s, snap('abc'), true); // continued typing: coalesced
    s = commitHistory(s, snap('abcd'), true);
    s = undoHistory(s);
    expect(s.present.value).toBe('a'); // undo jumps past the whole typing burst
  });

  it('redoes an undone change and clears redo on a new commit', () => {
    let s = initHistory(snap('a'));
    s = commitHistory(s, snap('ab'), false);
    s = undoHistory(s);
    s = redoHistory(s);
    expect(s.present.value).toBe('ab');

    s = undoHistory(s); // back to 'a', redo available
    expect(canRedo(s)).toBe(true);
    s = commitHistory(s, snap('aX'), false); // a new edit drops the redo branch
    expect(canRedo(s)).toBe(false);
  });

  it('treats a selection-only change (same value) as no new undo step', () => {
    let s = initHistory(snap('hello'));
    s = commitHistory(s, { value: 'hello', selectionStart: 0, selectionEnd: 5 }, false);
    expect(canUndo(s)).toBe(false);
    expect(s.present.selectionEnd).toBe(5);
  });

  it('undo/redo are no-ops at the ends of the stack', () => {
    const s = initHistory(snap('a'));
    expect(undoHistory(s)).toBe(s);
    expect(redoHistory(s)).toBe(s);
  });

  it('restores the stored selection on undo', () => {
    let s = initHistory({ value: 'a', selectionStart: 1, selectionEnd: 1 });
    s = commitHistory(s, { value: 'a**b**', selectionStart: 3, selectionEnd: 4 }, false);
    s = undoHistory(s);
    expect(s.present).toEqual({ value: 'a', selectionStart: 1, selectionEnd: 1 });
  });
});
