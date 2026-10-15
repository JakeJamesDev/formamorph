import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import { addTell, latestTurnId, pruneTells, REROLLED_TIMINGS, restoreTells, setTurnTells, turnTells, withoutTimings } from './scriptTells';

const turn = (turnId: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ narration: 'x', choices: [], turnId }) });
const action: ChatMessage = { role: 'user', content: 'I wait.' };

describe('script tells', () => {
  it('keeps a turn’s tells in call order', () => {
    const map = addTell(addTell({}, 't1', { text: 'First.', timing: 'before' }), 't1', { text: 'Second.', timing: 'after' });
    expect(turnTells(map, 't1').map((tell) => tell.text)).toEqual(['First.', 'Second.']);
    expect(turnTells(map, 't2')).toEqual([]);
    expect(turnTells(map, undefined)).toEqual([]);
  });

  it('drops only the re-rolled timings, keeping a switch tell in place', () => {
    const map = {
      t1: [
        { text: 'Start.', timing: 'start' as const }, { text: 'Switched.', timing: 'switch' as const },
        { text: 'Before.', timing: 'before' as const }, { text: 'After.', timing: 'after' as const },
      ],
    };
    expect(withoutTimings(map, 't1', REROLLED_TIMINGS)).toEqual({ t1: [{ text: 'Switched.', timing: 'switch' }] });
    expect(withoutTimings({ t1: [{ text: 'Before.', timing: 'before' }] }, 't1', REROLLED_TIMINGS)).toEqual({});
  });

  it('sets a turn’s tells, and none removes the entry', () => {
    const tell = { text: 'Back.', timing: 'before' as const };
    expect(setTurnTells({}, 't1', [tell])).toEqual({ t1: [tell] });
    expect(setTurnTells({ t1: [tell] }, 't1', [])).toEqual({});
  });

  it('reads the newest turn’s id, and none before the first narration', () => {
    expect(latestTurnId([action])).toBeUndefined();
    expect(latestTurnId([action, turn('t1'), action, turn('t2')])).toBe('t2');
  });

  it('drops the tells of a turn that left the history', () => {
    const map = { t1: [{ text: 'Kept.', timing: 'before' as const }], t2: [{ text: 'Rolled back.', timing: 'before' as const }] };
    expect(pruneTells(map, [action, turn('t1')])).toEqual({ t1: [{ text: 'Kept.', timing: 'before' }] });
  });

  it('reads back only well-formed tells from a save', () => {
    expect(restoreTells({
      t1: [{ text: 'Hi.', timing: 'after' }, { text: 'No timing.' }, { text: 'Bad.', timing: 'later' }, 'bare', null],
      t2: 'no',
      t3: [],
    })).toEqual({ t1: [{ text: 'Hi.', timing: 'after' }] });
    expect(restoreTells(undefined)).toEqual({});
    expect(restoreTells('junk')).toEqual({});
  });
});
