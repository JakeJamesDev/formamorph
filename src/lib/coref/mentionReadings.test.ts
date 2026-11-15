import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import {
  narrationHash, newestTurnNarration, pruneByNarration, restoreMentionReadings, turnMentionReading, type MentionReadingMap,
} from './mentionReadings';

const turn = (turnId: string, narration: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ turnId, narration, choices: [] }) });
const reading = { mentions: [{ start: 0, end: 4, entityId: 'mira' }], quotes: [] };
const entry = (narration: string) => ({ model: 'small' as const, version: 1, textHash: narrationHash(narration), reading });

describe('turn mention readings', () => {
  it('reads a turn’s reading only for the narration it read', () => {
    const map: MentionReadingMap = { t1: entry('Mira left.') };
    expect(turnMentionReading(map, 't1', 'Mira left.')).toEqual(reading);
    expect(turnMentionReading(map, 't1', 'Mira stayed.')).toBeNull();
    expect(turnMentionReading(map, 't2', 'Mira left.')).toBeNull();
  });

  it('drops readings of rewound turns and of turns whose narration changed', () => {
    const map: MentionReadingMap = { t1: entry('Mira left.'), t2: entry('She ran.'), t3: entry('Gone.') };
    const history = [{ role: 'user' as const, content: 'go' }, turn('t1', 'Mira left.'), turn('t2', 'She walked.')];
    expect(Object.keys(pruneByNarration(map, history))).toEqual(['t1']);
  });

  it('keeps the same map when nothing drops', () => {
    const map: MentionReadingMap = { t1: entry('Mira left.') };
    expect(pruneByNarration(map, [turn('t1', 'Mira left.')])).toBe(map);
  });

  it('names the newest turn', () => {
    expect(newestTurnNarration([turn('t1', 'A.'), turn('t2', 'B.')])).toEqual({ turnId: 't2', narration: 'B.' });
    expect(newestTurnNarration([])).toBeNull();
  });

  it('restores only well-formed readings from a save', () => {
    const restored = restoreMentionReadings({
      good: { ...entry('x'), extra: 1 },
      badModel: { ...entry('x'), model: 'huge' },
      badSpan: { ...entry('x'), reading: { mentions: [{ start: 'a', end: 2, entityId: null }], quotes: [] } },
      notObject: 5,
    });
    expect(restored).toEqual({ good: entry('x') });
  });
});
