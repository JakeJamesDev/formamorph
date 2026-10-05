import { describe, expect, it, vi } from 'vitest';
import { insertableSnippet, registerStatCodeInsert, statCodeInsertTarget, subscribeStatCodeInsert } from './statCodeInsert';

describe('insertableSnippet', () => {
  it('reads the slot from the fence meta', () => {
    expect(insertableSnippet('return 1;', 'before')).toEqual({ slot: 'before', code: 'return 1;' });
    expect(insertableSnippet('return 1;', 'after')).toEqual({ slot: 'after', code: 'return 1;' });
  });

  it('names no slot for an untagged fence or any other meta', () => {
    expect(insertableSnippet('return 1;', undefined)).toEqual({ slot: undefined, code: 'return 1;' });
    expect(insertableSnippet('return 1;', 'title="x"')).toEqual({ slot: undefined, code: 'return 1;' });
  });

  it('drops a first line that is only a slot word and reads it as the slot', () => {
    expect(insertableSnippet('after\nreturn 1;', undefined)).toEqual({ slot: 'after', code: 'return 1;' });
    expect(insertableSnippet('  Before \nself.value = 2;', undefined)).toEqual({ slot: 'before', code: 'self.value = 2;' });
  });

  it('keeps the fence slot over the first-line word, and still drops the line', () => {
    expect(insertableSnippet('after\nreturn 1;', 'before')).toEqual({ slot: 'before', code: 'return 1;' });
  });

  it('keeps a first line that holds more than the word', () => {
    expect(insertableSnippet('after = 2;\nreturn after;', undefined)).toEqual({ slot: undefined, code: 'after = 2;\nreturn after;' });
  });
});

describe('the insert registration', () => {
  it('holds the latest panel, tells subscribers, and clears on unregister', () => {
    const listener = vi.fn();
    const stop = subscribeStatCodeInsert(listener);
    const panel = { statName: 'Health', insert: vi.fn() };
    const unregister = registerStatCodeInsert(panel);
    expect(statCodeInsertTarget()).toBe(panel);
    unregister();
    expect(statCodeInsertTarget()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it('leaves a newer panel registered when an older one unregisters', () => {
    const unregisterOld = registerStatCodeInsert({ statName: 'Old', insert: vi.fn() });
    const newer = { statName: 'New', insert: vi.fn() };
    const unregisterNew = registerStatCodeInsert(newer);
    unregisterOld();
    expect(statCodeInsertTarget()).toBe(newer);
    unregisterNew();
  });
});
