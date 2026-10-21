import { describe, expect, it, vi } from 'vitest';
import { createScriptPromptStore, isPromptCanceled, namesPlayer, PromptCanceled } from './scriptPrompts';

const ids = () => {
  let n = 0;
  return () => `p${++n}`;
};

describe('createScriptPromptStore', () => {
  it('holds an ask open until the UI answers with an option index', async () => {
    const store = createScriptPromptStore(ids());
    const listener = vi.fn();
    store.subscribe(listener);
    const answer = store.prompt({ kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false });
    expect(store.pending()).toEqual([{ id: 'p1', request: { kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false } }]);
    expect(listener).toHaveBeenCalledTimes(1);
    store.answer('p1', 1);
    await expect(answer).resolves.toBe(1);
    expect(store.pending()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects a cancel as PromptCanceled and closes the prompt', async () => {
    const store = createScriptPromptStore(ids());
    store.subscribe(() => {});
    const answer = store.prompt({ kind: 'confirm', question: 'Sure?' });
    store.cancel('p1');
    await expect(answer).rejects.toBeInstanceOf(PromptCanceled);
    expect(store.pending()).toEqual([]);
  });

  it('keeps prompts in the order they opened and answers each by id', async () => {
    const store = createScriptPromptStore(ids());
    store.subscribe(() => {});
    const first = store.prompt({ kind: 'input', question: 'Name?' });
    const second = store.prompt({ kind: 'confirm', question: 'Sure?' });
    expect(store.pending().map((prompt) => prompt.id)).toEqual(['p1', 'p2']);
    store.answer('p2', false);
    expect(store.pending().map((prompt) => prompt.id)).toEqual(['p1']);
    store.answer('p1', 'Ada');
    await expect(first).resolves.toBe('Ada');
    await expect(second).resolves.toBe(false);
  });

  it('refuses an answer that does not fit and leaves the prompt open', () => {
    const store = createScriptPromptStore(ids());
    store.subscribe(() => {});
    void store.prompt({ kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false }).catch(() => {});
    expect(() => store.answer('p1', 2)).toThrow(TypeError);
    expect(() => store.answer('p1', [0])).toThrow(TypeError);
    expect(() => store.answer('p1', 'Left')).toThrow(TypeError);
    expect(store.pending()).toHaveLength(1);
    void store.prompt({ kind: 'ask', question: 'Doors?', options: ['Left', 'Right'], multiple: true }).catch(() => {});
    expect(() => store.answer('p2', 1)).toThrow(TypeError);
    expect(() => store.answer('p2', [0, 5])).toThrow(TypeError);
    expect(() => store.answer('p2', [1, 0])).not.toThrow();
    expect(() => store.answer('missing', true)).toThrow(/No open prompt/);
  });

  it('cancels an ask at once when nothing listens, and resolves a tell with nothing shown', async () => {
    const store = createScriptPromptStore(ids());
    await expect(store.prompt({ kind: 'ask', question: 'Door?', options: ['Left'], multiple: false })).rejects.toSatisfy(isPromptCanceled);
    await expect(store.prompt({ kind: 'confirm', question: 'Sure?' })).rejects.toSatisfy(isPromptCanceled);
    await expect(store.prompt({ kind: 'input', question: 'Name?' })).rejects.toSatisfy(isPromptCanceled);
    await expect(store.prompt({ kind: 'tell', text: 'Hi' })).resolves.toBeUndefined();
    await expect(store.prompt({ kind: 'toast', text: 'Hi' })).resolves.toBeUndefined();
    expect(store.pending()).toEqual([]);
  });

  it('stops notifying a listener that unsubscribed', () => {
    const store = createScriptPromptStore(ids());
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.subscribe(() => {});
    void store.prompt({ kind: 'confirm', question: 'A?' }).catch(() => {});
    stop();
    void store.prompt({ kind: 'confirm', question: 'B?' }).catch(() => {});
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('namesPlayer', () => {
  it('matches a call on player and nothing that only contains the word', () => {
    expect(namesPlayer("const pick = player.ask('Door?', ['Left', 'Right']);")).toBe(true);
    expect(namesPlayer('player .tell("hi")')).toBe(true);
    expect(namesPlayer('return stats.player.value;')).toBe(true);
    expect(namesPlayer('const player = 1; return player;')).toBe(false);
    expect(namesPlayer('return multiplayer.value;')).toBe(false);
    expect(namesPlayer('return persona.traits.Brave.enabled ? 1 : 0;')).toBe(false);
  });
});
