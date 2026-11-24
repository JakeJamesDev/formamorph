import { describe, expect, it } from 'vitest';
import {
  deletedMemoryIds, hasMemoryChanges, isMemoryDeleted, memoryRewrite, withMemoryDeleted, withMemoryText,
  withoutMemoryChanges, withoutMemoryText, withoutTurnText, type TurnTextEdits,
} from './turnTextEdits';

const diaryEdits: TurnTextEdits = {
  t1: { diaries: { Bram: { text: 'I lied to her.', source: 'player' } } },
};

describe('the memory part of the text edit layer', () => {
  it('reverts a rewrite under a delete to the AI text and keeps the delete', () => {
    let layer = withMemoryText({}, 't1', 'Mine.', 'player');
    layer = withMemoryDeleted(layer, 't1', true);
    expect(memoryRewrite(layer, 't1')).toEqual({ text: 'Mine.', source: 'player' });
    layer = withoutMemoryText(layer, 't1');
    expect(memoryRewrite(layer, 't1')).toBeUndefined();
    expect(isMemoryDeleted(layer, 't1')).toBe(true);
  });

  it('restores a deleted rewrite with its text, and removes a delete-only record', () => {
    const rewritten = withMemoryDeleted(withMemoryText({}, 't1', 'Mine.', 'player'), 't1', true);
    expect(withMemoryDeleted(rewritten, 't1', false)).toEqual({ t1: { memory: { text: 'Mine.', source: 'player' } } });
    expect(withMemoryDeleted(withMemoryDeleted({}, 't2', true), 't2', false)).toEqual({});
  });

  it('lists deletions and counts only memory changes', () => {
    const layer = withMemoryDeleted(withMemoryText(diaryEdits, 't2', 'Mine.', 'ai'), 'n1', true);
    expect(deletedMemoryIds(layer)).toEqual(['n1']);
    expect(hasMemoryChanges(layer)).toBe(true);
    expect(hasMemoryChanges(diaryEdits)).toBe(false);
  });

  it('resets every memory change and leaves diary changes', () => {
    const layer = withMemoryDeleted(withMemoryText(diaryEdits, 't1', 'Mine.', 'player'), 't2', true);
    expect(withoutMemoryChanges(layer)).toEqual(diaryEdits);
  });

  it('hands back the same layer when a write changes nothing', () => {
    const layer = withMemoryDeleted(withMemoryText({}, 't1', 'Mine.', 'player'), 't2', true);
    expect(withMemoryText(layer, 't1', 'Mine.', 'player')).toBe(layer);
    expect(withMemoryDeleted(layer, 't2', true)).toBe(layer);
    expect(withMemoryDeleted(layer, 't1', false)).toBe(layer);
    expect(withoutMemoryText(layer, 't2')).toBe(layer);
    expect(withoutTurnText(layer, 't9')).toBe(layer);
  });
});

describe('a narration edit on the text edit layer', () => {
  it('drops the turn’s rewrites and keeps its deletes, memory and diary alike', () => {
    const layer: TurnTextEdits = {
      t1: {
        memory: { text: 'Mine.', source: 'player', deleted: true },
        diaries: {
          Bram: { text: 'I lied.', source: 'player' },
          Wren: { text: 'Regenerated.', source: 'ai', deleted: true },
        },
      },
      t2: { memory: { text: 'Neighbor.', source: 'player' } },
    };
    expect(withoutTurnText(layer, 't1')).toEqual({
      t1: { memory: { source: 'player', deleted: true }, diaries: { Wren: { source: 'player', deleted: true } } },
      t2: { memory: { text: 'Neighbor.', source: 'player' } },
    });
  });

  it('removes a record left with no change', () => {
    const layer = withMemoryText(withMemoryText({}, 't1', 'Mine.', 'player'), 't2', 'Other.', 'player');
    expect(withoutTurnText(layer, 't1')).toEqual({ t2: { memory: { text: 'Other.', source: 'player' } } });
  });
});
