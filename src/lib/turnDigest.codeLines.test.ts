import { describe, expect, it } from 'vitest';
import { collectCharacterDiary, turnDiaries, turnMemory } from './turnDigest';
import { parseTurns } from './turnBanding';
import type { AITurnResult, ChatMessage } from '@/types';

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
    expect(turnDiaries(turn({ diaries: { Mira: 'I saw it fall.' }, codeDiaries: { Mira: ['I ran.'], Tor: ['I lied.'] } })))
      .toEqual({ Mira: 'I saw it fall. I ran.', Tor: 'I lied.' });
  });

  it('joins code lines to the entry of the same name in another case, under the entry’s spelling', () => {
    expect(turnDiaries(turn({ diaries: { Mira: 'I saw it fall.' }, codeDiaries: { mira: ['I ran.'] } }))).toEqual({ Mira: 'I saw it fall. I ran.' });
  });

  it('drops a nothing notable entry in favor of the code lines', () => {
    expect(turnDiaries(turn({ diaries: { Mira: 'Nothing notable' }, codeDiaries: { Mira: ['I ran.'] } }))).toEqual({ Mira: 'I ran.' });
  });

  it('builds a character’s diary from both, across turns', () => {
    const history = historyOf(
      turn({ diaries: { Mira: 'I saw it fall.' } }),
      turn({ codeDiaries: { Mira: ['I ran.'] } }),
    );
    expect(collectCharacterDiary(history, 'mira', 10)).toEqual(['I saw it fall.', 'I ran.']);
  });
});
