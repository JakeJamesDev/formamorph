import { describe, expect, it, vi } from 'vitest';
import { pickHistoryRecall, type RecallBook } from './historyRecall';

const book = (over: Partial<RecallBook> = {}): RecallBook => ({ lastRecallTurn: null, lastFired: new Map(), ...over });

describe('pickHistoryRecall', () => {
  it('records a live trim’s picks at this turn', () => {
    const recall = book();
    const picks = pickHistoryRecall({ live: true, turnCount: 7, book: recall, sticky: new Set(['t1']), select: () => ['t3'] });
    expect(picks).toEqual({ semanticRehydrate: ['t3'], stickyIds: new Set(['t1']) });
    expect(recall).toEqual({ lastRecallTurn: 7, lastFired: new Map([['t3', 7]]) });
  });

  it('keeps out a turn still cooling down from an earlier recall', () => {
    const select = vi.fn((blocked: ReadonlySet<string>) => [...blocked]);
    pickHistoryRecall({ live: true, turnCount: 7, book: book({ lastFired: new Map([['t3', 6]]) }), sticky: new Set(), select });
    expect(select).toHaveBeenCalledWith(new Set(['t3']));
  });

  it('re-renders with the first trim’s picks, selecting and recording nothing again', () => {
    const recall = book();
    const first = pickHistoryRecall({ live: true, turnCount: 7, book: recall, sticky: new Set(['t1']), select: () => ['t3'] });
    const select = vi.fn(() => ['t5']);
    const again = pickHistoryRecall({ live: false, picks: first, turnCount: 7, book: recall, sticky: new Set(['t3']), select });
    expect(again).toEqual(first);
    expect(select).not.toHaveBeenCalled();
    expect(recall).toEqual({ lastRecallTurn: 7, lastFired: new Map([['t3', 7]]) });
  });

  it('records nothing for a preview trim', () => {
    const recall = book({ lastRecallTurn: 6 });
    pickHistoryRecall({ live: false, turnCount: 7, book: recall, sticky: new Set(), select: () => ['t3'] });
    expect(recall).toEqual({ lastRecallTurn: 6, lastFired: new Map() });
  });

  it('picks no rehydration when semantic recall is off', () => {
    expect(pickHistoryRecall({ live: true, turnCount: 7, book: book(), sticky: new Set(), select: null }).semanticRehydrate).toBeNull();
  });
});
