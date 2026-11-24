import { describe, expect, it } from 'vitest';
import {
  deletedMemoryIds, diaryEdit, hasDiaryChanges, hasMemoryChanges, isDiaryDeleted, isMemoryDeleted, memoryRewrite,
  withDiaryDeleted, withDiaryText, withMemoryDeleted, withMemoryText, withoutDiaryChanges, withoutDiaryText,
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

describe('the diary part of the text edit layer', () => {
  it('rewrites, deletes, restores and reverts one entry, leaving the memory alone', () => {
    let layer = withMemoryText({}, 't1', 'Mine.', 'player');
    layer = withDiaryText(layer, 't1', 'Bram', 'I lied.', 'player');
    layer = withDiaryDeleted(layer, 't1', 'Bram', true);
    expect(layer.t1).toEqual({ memory: { text: 'Mine.', source: 'player' }, diaries: { Bram: { text: 'I lied.', source: 'player', deleted: true } } });
    expect(isDiaryDeleted(layer, 't1', 'bram')).toBe(true);
    layer = withDiaryDeleted(layer, 't1', 'Bram', false);
    expect(diaryEdit(layer, 't1', 'Bram')).toEqual({ text: 'I lied.', source: 'player' });
    layer = withoutDiaryText(layer, 't1', 'Bram');
    expect(layer).toEqual({ t1: { memory: { text: 'Mine.', source: 'player' } } });
  });

  it('keeps a delete when its rewrite is reverted, and removes a delete-only record on restore', () => {
    const layer = withDiaryDeleted(withDiaryText({}, 't1', 'Bram', 'I lied.', 'ai'), 't1', 'Bram', true);
    expect(withoutDiaryText(layer, 't1', 'Bram')).toEqual({ t1: { diaries: { Bram: { source: 'player', deleted: true } } } });
    expect(withDiaryDeleted(withDiaryDeleted({}, 't2', 'Wick', true), 't2', 'Wick', false)).toEqual({});
  });

  it('resets one diary on every turn and spelling, leaving memories and other diaries', () => {
    const layer: TurnTextEdits = {
      t1: { memory: { text: 'Mine.', source: 'player' }, diaries: { Bram: { text: 'A.', source: 'player' }, Wick: { source: 'player', deleted: true } } },
      t2: { diaries: { bram: { text: 'B.', source: 'ai' } } },
    };
    expect(hasDiaryChanges(layer, 'BRAM')).toBe(true);
    const reset = withoutDiaryChanges(layer, 'Bram');
    expect(reset).toEqual({ t1: { memory: { text: 'Mine.', source: 'player' }, diaries: { Wick: { source: 'player', deleted: true } } } });
    expect(hasDiaryChanges(reset, 'Bram')).toBe(false);
  });

  it('hands back the same layer when a diary write changes nothing', () => {
    const layer = withDiaryText({}, 't1', 'Bram', 'I lied.', 'player');
    expect(withDiaryText(layer, 't1', 'Bram', 'I lied.', 'player')).toBe(layer);
    expect(withDiaryDeleted(layer, 't1', 'Bram', false)).toBe(layer);
    expect(withoutDiaryText(layer, 't1', 'Wick')).toBe(layer);
    expect(withoutDiaryChanges(layer, 'Wick')).toBe(layer);
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
