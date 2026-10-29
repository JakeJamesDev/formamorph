import { describe, expect, it } from 'vitest';
import { parseTurns } from '@/lib/turnBanding';
import type { ChatMessage } from '@/types';
import { storySoFar } from './storySoFar';

const user = (content: string): ChatMessage => ({ role: 'user', content });
const narrated = (narration: string, extra: Record<string, unknown> = {}): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration, choices: [], stat_changes: [], ...extra }),
});

const story = (history: ChatMessage[], budget?: number) =>
  storySoFar({ turns: parseTurns(history), memoryDigests: true, verbatimFloor: 1, milestoneDrop: null, stripMedia: false, budget });

describe('the story so far', () => {
  it('holds a memory once when its turn has no turn id, never as a turn', () => {
    const { text, turns } = story([user('I knock.'), narrated('The door opens.', { summary: 'You knocked.' }), user('I enter.'), narrated('The hall is dark.')]);
    expect(turns).toEqual([{ action: 'I enter.', narration: 'The hall is dark.' }]);
    expect(text.match(/You knocked\./g)).toHaveLength(1);
  });

  it('drops the oldest memory first to stay inside its budget', () => {
    // Memories of a realistic length, so the banding's own overhead is small against them.
    const first = 'The first memory of the road. '.repeat(40).trim();
    const second = 'The second memory of the gate. '.repeat(40).trim();
    const history = [
      user('a'), narrated('One.', { turnId: 't1', summary: first }),
      user('b'), narrated('Two.', { turnId: 't2', summary: second }),
      user('c'), narrated('Three.', { turnId: 't3' }),
    ];
    const full = story(history).text;
    expect(full).toContain(first);
    const cut = story(history, full.length - 1);
    expect(cut.memories).toBe(second);
    expect(cut.text.length).toBeLessThan(full.length);
  });
});
