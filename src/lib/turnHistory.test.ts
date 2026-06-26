import { describe, it, expect } from 'vitest';
import {
  rollbackState,
  regenerateState,
  canRegenerate,
  lastTurnAction,
  markRegeneratedTurn,
  markPrunedTurns,
  snapshotPageIndex,
  placeSnapshot,
} from './turnHistory';

// Stand-in for the AI-context DebugTurn — carries the flags plus an identifying field.
type Turn = { action: string; regenerated?: boolean; pruned?: boolean };

// Snapshots saved after turns 1, 2, 3 (i.e. pages 1, 2, 3).
const states = ['s1', 's2', 's3'];

describe('rollbackState', () => {
  it('returns the snapshot of the page being rolled back to', () => {
    expect(rollbackState(states, 1)).toBe('s1');
    expect(rollbackState(states, 2)).toBe('s2');
  });
  it('returns null when the index is out of range', () => {
    expect(rollbackState(states, 0)).toBeNull();
    expect(rollbackState([], 1)).toBeNull();
  });
});

describe('regenerateState', () => {
  it("uses the previous turn's snapshot for turn 2 or later", () => {
    expect(regenerateState(states, 'init', 2)).toBe('s1'); // before turn 2 = state after turn 1
    expect(regenerateState(states, 'init', 3)).toBe('s2');
  });
  it('uses the captured pre-game state for the opening turn (page 1)', () => {
    expect(regenerateState(states, 'init', 1)).toBe('init');
  });
  it('returns null when no snapshot is available', () => {
    expect(regenerateState([], null, 1)).toBeNull(); // page 1, never captured
    expect(regenerateState([], 'init', 2)).toBeNull(); // page 2, gameStates[0] missing
  });
});

describe('canRegenerate', () => {
  it('is true only on the latest page when at least one turn exists', () => {
    expect(canRegenerate(3, 3)).toBe(true);
    expect(canRegenerate(1, 1)).toBe(true); // page 1 is now allowed
  });
  it('is false on a past page or before any turn exists', () => {
    expect(canRegenerate(2, 3)).toBe(false);
    expect(canRegenerate(0, 0)).toBe(false);
  });
});

describe('lastTurnAction', () => {
  it('returns the action of the latest completed turn', () => {
    const history = [
      { role: 'user', content: 'look around' },
      { role: 'assistant', content: '...' },
    ];
    expect(lastTurnAction(history)).toBe('look around');
  });
  it('returns null when the tail is not a completed user→assistant pair', () => {
    expect(lastTurnAction([])).toBeNull();
    expect(lastTurnAction([{ role: 'user', content: 'x' }])).toBeNull(); // no assistant reply yet
    expect(
      lastTurnAction([
        { role: 'assistant', content: 'a' },
        { role: 'assistant', content: 'b' },
      ]),
    ).toBeNull();
  });
});

describe('markRegeneratedTurn', () => {
  it('flags only the most recent turn', () => {
    const turns: Turn[] = [{ action: 'a' }, { action: 'b' }];
    const out = markRegeneratedTurn(turns);
    expect(out[0]).toEqual({ action: 'a' });
    expect(out[1]).toEqual({ action: 'b', regenerated: true });
  });
  it('does not mutate the input and tolerates an empty log', () => {
    const turns: Turn[] = [{ action: 'a' }];
    markRegeneratedTurn(turns);
    expect(turns[0]).toEqual({ action: 'a' });
    expect(markRegeneratedTurn([] as Turn[])).toEqual([]);
  });
});

describe('markPrunedTurns', () => {
  it('flags every turn after the page rolled back to', () => {
    const turns: Turn[] = [{ action: '1' }, { action: '2' }, { action: '3' }, { action: '4' }];
    const out = markPrunedTurns(turns, 2); // rolled back to page 2 → discard turns 3 and 4
    expect(out.map((t) => Boolean(t.pruned))).toEqual([false, false, true, true]);
  });
  it('does not mutate the input', () => {
    const turns: Turn[] = [{ action: '1' }, { action: '2' }];
    markPrunedTurns(turns, 1);
    expect(turns.every((t) => !('pruned' in t))).toBe(true);
  });
});

describe('snapshotPageIndex', () => {
  it('maps a turn (two messages each) to its zero-based slot', () => {
    expect(snapshotPageIndex(2, 2)).toBe(0); // after turn 1
    expect(snapshotPageIndex(4, 2)).toBe(1); // after turn 2
    expect(snapshotPageIndex(6, 2)).toBe(2); // after turn 3
  });
});

describe('placeSnapshot', () => {
  it('appends when the slot is past the end and overwrites when it exists', () => {
    expect(placeSnapshot(['a'], 1, 'b')).toEqual(['a', 'b']); // next turn → append
    expect(placeSnapshot(['a', 'b'], 1, 'B')).toEqual(['a', 'B']); // re-save → overwrite
  });
  it('does not mutate the input', () => {
    const states = ['a'];
    placeSnapshot(states, 1, 'b');
    expect(states).toEqual(['a']);
  });
});

// Regression: the abort-then-rollback bug. Indexing each snapshot by its own history length must keep
// gameStates dense — including the turn kept after an abort — so rollback maps page → state correctly.
// (The bug indexed off a stale closure length, producing a sparse [2,6] where rollback no-op'd.)
describe('per-turn snapshot stack stays aligned', () => {
  const messagesPerPage = 2;
  // Replays normal turn 1, normal turn 2, then an aborted-but-kept turn 3 — each saving by its own length.
  const save = (states: number[], historyLength: number) =>
    placeSnapshot(states, snapshotPageIndex(historyLength, messagesPerPage), historyLength);

  it('builds a dense [2,4,6] across two turns plus a kept abort', () => {
    let states: number[] = [];
    states = save(states, 2); // turn 1
    states = save(states, 4); // turn 2
    states = save(states, 6); // turn 3 aborted, narration kept
    expect(states).toEqual([2, 4, 6]);
  });

  it('rolls a paged-back turn to the correct earlier state (not a no-op)', () => {
    const states = [2, 4, 6];
    // On page 2 of 3, rollback restores gameStates[currentPage - 1] = the turn-2 state (4), not the
    // current turn-3 state (6). A sparse array would have returned 6 and silently done nothing.
    expect(rollbackState(states, 2)).toBe(4);
  });
});
