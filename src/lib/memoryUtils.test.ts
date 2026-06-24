import { describe, it, expect } from 'vitest';
import { estimateHistoryChars } from './memoryUtils';
import type { ChatMessage } from '@/types';

describe('estimateHistoryChars', () => {
  it('counts an assistant message by its parsed game_text only', () => {
    const history: ChatMessage[] = [
      {
        role: 'assistant',
        content: JSON.stringify({ game_text: 'hello', choices: ['a', 'b'] }),
      },
    ];
    expect(estimateHistoryChars(history)).toBe('hello'.length);
  });

  it('falls back to full content when assistant JSON is invalid', () => {
    const history: ChatMessage[] = [{ role: 'assistant', content: 'not json' }];
    expect(estimateHistoryChars(history)).toBe('not json'.length);
  });

  it('counts user messages by full content', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'look around' }];
    expect(estimateHistoryChars(history)).toBe('look around'.length);
  });

  it('skips messages with empty or missing content', () => {
    const history = [
      { role: 'user', content: '' },
      { role: 'user', content: 'abc' },
      null as unknown as ChatMessage,
    ] as ChatMessage[];
    expect(estimateHistoryChars(history)).toBe(3);
  });

  it('sums a mixed history', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: '12345' },
      { role: 'assistant', content: JSON.stringify({ game_text: 'abc' }) },
    ];
    expect(estimateHistoryChars(history)).toBe(8);
  });
});
