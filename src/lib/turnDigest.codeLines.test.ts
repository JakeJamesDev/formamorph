import { describe, expect, it } from 'vitest';
import { collectCharacterDiary, turnDiaries, turnMemory } from './turnDigest';
import { parseTurns } from './turnBanding';
import type { AITurnResult, ChatMessage } from '@/types';
import type { TurnTextEdits } from './turnTextEdits';

const turn = (over: Partial<AITurnResult>): AITurnResult => ({ narration: 'The gate falls.', choices: [], stat_changes: [], ...over });
const historyOf = (...turns: AITurnResult[]): ChatMessage[] =>
  turns.flatMap((t) => [{ role: 'user' as const, content: 'go' }, { role: 'assistant' as const, content: JSON.stringify(t) }]);

describe('a turn’s memory', () => {
  it('reads the digest, then the code lines in call order', () => {
    expect(turnMemory(turn({ summary: 'The gate fell.', codeMemory: ['Tor lied.', 'Mira ran.'] }))).toBe('The gate fell. Tor lied. Mira ran.');
  });

  it('reads the code lines alone before the digest is written', () => {
    expect(turnMemory(turn({ codeMemory: ['Tor lied.'] }))).toBe('Tor lied.');
  });

  it('reads the digest as stored with no code lines, and nothing with neither', () => {
    expect(turnMemory(turn({ summary: 'The gate fell.' }))).toBe('The gate fell.');
    expect(turnMemory(turn({ summary: '' }))).toBe('');
    expect(turnMemory(turn({}))).toBeUndefined();
  });

  it('reaches recall through the parsed turns', () => {
    const [parsed] = parseTurns(historyOf(turn({ turnId: 't1', summary: 'The gate fell.', codeMemory: ['Tor lied.'] })));
    expect(parsed.summary).toBe('The gate fell. Tor lied.');
  });
});

describe('a turn’s diaries', () => {
  it('reads each entity’s diary entry, then its code lines', () => {
    expect(turnDiaries(turn({ diaries: { Mira: 'I saw it fall.' }, codeDiaries: { Mira: ['I ran.'], Tor: ['I lied.'] } }), undefined))
      .toEqual({ Mira: 'I saw it fall. I ran.', Tor: 'I lied.' });
  });

  it('joins code lines to the entry of the same name in another case, under the entry’s spelling', () => {
    expect(turnDiaries(turn({ diaries: { Mira: 'I saw it fall.' }, codeDiaries: { mira: ['I ran.'] } }), undefined)).toEqual({ Mira: 'I saw it fall. I ran.' });
  });

  it('drops a nothing notable entry in favor of the code lines', () => {
    expect(turnDiaries(turn({ diaries: { Mira: 'Nothing notable' }, codeDiaries: { Mira: ['I ran.'] } }), undefined)).toEqual({ Mira: 'I ran.' });
  });

  it('builds a character’s diary from both, across turns', () => {
    const history = historyOf(
      turn({ diaries: { Mira: 'I saw it fall.' } }),
      turn({ codeDiaries: { Mira: ['I ran.'] } }),
    );
    expect(collectCharacterDiary(history, 'mira', 10, undefined)).toEqual(['I saw it fall.', 'I ran.']);
  });
});

describe('a character’s diary through the player’s changes', () => {
  const history = historyOf(
    turn({ turnId: 't1', diaries: { Mira: 'I trust Tor.' } }),
    turn({ turnId: 't2', diaries: { Mira: 'Tor saved me.' }, codeDiaries: { Mira: ['I ran.'] } }),
    turn({ turnId: 't3', diaries: { Mira: 'nothing notable' } }),
  );

  it('reads an edited entry, drops a deleted one, and keeps the script lines beside it', () => {
    const layer: TurnTextEdits = {
      t1: { diaries: { Mira: { text: 'I never trusted Tor.', source: 'player' } } },
      t2: { diaries: { Mira: { source: 'player', deleted: true } } },
    };
    expect(collectCharacterDiary(history, 'Mira', 10, layer)).toEqual(['I never trusted Tor.', 'I ran.']);
  });

  it('reads a quiet entry edited into a real one, and a kept rewrite under a restored delete', () => {
    const layer: TurnTextEdits = {
      t2: { diaries: { Mira: { text: 'Tor carried me out.', source: 'ai' } } },
      t3: { diaries: { Mira: { text: 'I can still smell the smoke.', source: 'player' } } },
    };
    expect(collectCharacterDiary(history, 'mira', 10, layer)).toEqual(['I trust Tor.', 'Tor carried me out. I ran.', 'I can still smell the smoke.']);
  });

  it('reads nothing of a deleted entry, the rewrite under it included', () => {
    const layer: TurnTextEdits = { t1: { diaries: { Mira: { text: 'Hidden.', source: 'player', deleted: true } } } };
    expect(turnDiaries(turn({ turnId: 't1', diaries: { Mira: 'I trust Tor.' } }), layer)).toEqual({});
  });
});
