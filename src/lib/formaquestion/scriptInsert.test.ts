import { describe, expect, it, vi } from 'vitest';
import { insertableSnippet, registerScriptInsert, scriptInsertTarget, subscribeScriptInsert } from './scriptInsert';

describe('insertableSnippet', () => {
  it.each(['before', 'after', 'output', 'start', 'switch'] as const)('reads the %s timing from the fence meta', (timing) => {
    expect(insertableSnippet('return 1;', timing)).toEqual({ timing, code: 'return 1;' });
  });

  it.each(['output', 'start', 'switch'] as const)('reads %s from a first line', (timing) => {
    expect(insertableSnippet(`${timing}\nreturn 1;`, undefined)).toEqual({ timing, code: 'return 1;' });
  });

  it('names no timing for an untagged fence or any other meta', () => {
    expect(insertableSnippet('return 1;', undefined)).toEqual({ timing: undefined, code: 'return 1;' });
    expect(insertableSnippet('return 1;', 'title="x"')).toEqual({ timing: undefined, code: 'return 1;' });
  });

  it('drops a first line that is only a timing word and reads it as the timing', () => {
    expect(insertableSnippet('after\nreturn 1;', undefined)).toEqual({ timing: 'after', code: 'return 1;' });
    expect(insertableSnippet('  Before \nself.value = 2;', undefined)).toEqual({ timing: 'before', code: 'self.value = 2;' });
  });

  it('keeps the fence timing over the first-line word, and still drops the line', () => {
    expect(insertableSnippet('after\nreturn 1;', 'before')).toEqual({ timing: 'before', code: 'return 1;' });
  });

  it('keeps a first line that holds more than the word', () => {
    expect(insertableSnippet('after = 2;\nreturn after;', undefined)).toEqual({ timing: undefined, code: 'after = 2;\nreturn after;' });
  });
});

describe('the insert registration', () => {
  it('holds the latest panel, tells subscribers, and clears on unregister', () => {
    const listener = vi.fn();
    const stop = subscribeScriptInsert(listener);
    const panel = { homeName: 'Health', insert: vi.fn() };
    const unregister = registerScriptInsert(panel);
    expect(scriptInsertTarget()).toBe(panel);
    unregister();
    expect(scriptInsertTarget()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it('leaves a newer panel registered when an older one unregisters', () => {
    const unregisterOld = registerScriptInsert({ homeName: 'Old', insert: vi.fn() });
    const newer = { homeName: 'New', insert: vi.fn() };
    const unregisterNew = registerScriptInsert(newer);
    unregisterOld();
    expect(scriptInsertTarget()).toBe(newer);
    unregisterNew();
  });
});
