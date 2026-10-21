import { describe, expect, it } from 'vitest';
import { deletedAfter, editsAfter, notesAfter, pinsAfter } from './memoryWrites';
import type { MemoryWrite } from './statCodeExecutor';
import type { MemoryNote } from './memoryOverrides';

const note: MemoryNote = { id: 'n1', text: 'The bridge is out.', anchorTurn: 4 };

describe('memory entry writes on the save fields', () => {
  const writes: MemoryWrite[] = [
    { id: 't1', kind: 'forget' },
    { id: 't2', kind: 'pin' },
    { id: 't3', kind: 'edit', text: 'Rewritten.', custom: false },
    { id: 't4', kind: 'remove' },
  ];

  it('lands verdicts on the pins, the edit on the overrides and the removal on the deleted set', () => {
    expect(pinsAfter({}, writes)).toEqual({ t1: 'drop', t2: 'keep', t3: 'keep' });
    expect(editsAfter({}, writes)).toEqual({ t3: { text: 'Rewritten.', source: 'player' } });
    expect(deletedAfter([], writes)).toEqual(['t4']);
    expect(notesAfter([note], writes)).toEqual([note]);
  });

  it('applies in call order: the later verdict on one row stands', () => {
    expect(pinsAfter({}, [{ id: 't1', kind: 'pin' }, { id: 't1', kind: 'forget' }])).toEqual({ t1: 'drop' });
    expect(pinsAfter({}, [{ id: 't1', kind: 'forget' }, { id: 't1', kind: 'pin' }])).toEqual({ t1: 'keep' });
    expect(pinsAfter({}, [{ id: 't1', kind: 'forget' }, { id: 't1', kind: 'edit', text: 'x', custom: false }])).toEqual({ t1: 'keep' });
    expect(pinsAfter({}, [{ id: 't1', kind: 'edit', text: 'x', custom: false }, { id: 't1', kind: 'forget' }])).toEqual({ t1: 'drop' });
  });

  it('rewrites a Custom line’s text in place, with no override and no pin', () => {
    const edit: MemoryWrite[] = [{ id: 'n1', kind: 'edit', text: 'The bridge is fixed.', custom: true }];
    expect(notesAfter([note], edit)).toEqual([{ ...note, text: 'The bridge is fixed.' }]);
    expect(editsAfter({}, edit)).toEqual({});
    expect(pinsAfter({}, edit)).toEqual({});
  });

  it('keeps the player’s other entries and the same value when nothing changes', () => {
    const pins = { t9: 'keep' as const };
    expect(pinsAfter(pins, [{ id: 't1', kind: 'forget' }])).toEqual({ t9: 'keep', t1: 'drop' });
    expect(pinsAfter(pins, [{ id: 't9', kind: 'pin' }])).toBe(pins);
    const deleted = ['t4'];
    expect(deletedAfter(deleted, [{ id: 't4', kind: 'remove' }])).toBe(deleted);
  });
});
