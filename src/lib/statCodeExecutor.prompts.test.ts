/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import { createScriptPromptStore, PromptCanceled, type ScriptPromptHost, type ScriptPromptRequest } from './scriptPrompts';
import { runInSandbox } from './scriptSandbox';
import type { Stat } from '@/types';

vi.mock(import('./scriptSandbox'), { spy: true });

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

/** A host that answers every request with `answer(request)` after `delayMs`, and records what it was asked. */
function host(answer: (request: ScriptPromptRequest) => unknown, delayMs = 0) {
  const asked: ScriptPromptRequest[] = [];
  const prompts: ScriptPromptHost = {
    prompt: (request) => new Promise((resolve, reject) => {
      asked.push(request);
      setTimeout(() => {
        try {
          // The test picks the answer shape per request; the executor marshals whatever comes back.
          resolve(answer(request) as never);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, delayMs);
    }),
  };
  return { prompts, asked };
}

/** The engine the last run took, from the sandbox spy. */
const engineRan = () => vi.mocked(runInSandbox).mock.lastCall?.[3];

describe('executeStatCode on the async engine', () => {
  // Only the console spy is restored: `restoreAllMocks` would also drop the sandbox spy the engine check reads.
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errors = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => errors.mockRestore());

  it('suspends on player.ask and reads the answer the host supplies, on the async engine', async () => {
    const { prompts, asked } = host(() => 1);
    const code = `const pick = player.ask('Door?', ['Left', 'Right']); return pick === 'Right' ? 7 : 0;`;
    await expect(executeStatCode(code, [], makeStat({}), { prompts })).resolves.toEqual({ value: 7, error: null });
    expect(asked).toEqual([{ kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false }]);
    expect(engineRan()).toBe('async');
  });

  it('runs a script without player. on the sync engine', async () => {
    await expect(executeStatCode('return 3;', [], makeStat({}))).resolves.toEqual({ value: 3, error: null });
    expect(engineRan()).toBe('sync');
    await expect(executeStatCode('return typeof player === "undefined" ? 4 : 0;', [], makeStat({}))).resolves.toEqual({ value: 4, error: null });
    expect(engineRan()).toBe('sync');
  });

  it('maps label-value pairs back to their values, and multiple returns an array', async () => {
    const { prompts, asked } = host((request) => (request.kind === 'ask' && request.multiple ? [2, 0] : 0));
    const code = `
      const options = [{ label: 'Sword', value: 10 }, 'Shield', { label: 'Bow', value: { range: 5 } }];
      const one = player.ask('Pick one', options);
      const many = player.ask('Pick many', options, { multiple: true });
      return one === 10 && many.length === 2 && many[0].range === 5 && many[1] === 10 ? 1 : 0;`;
    await expect(executeStatCode(code, [], makeStat({}), { prompts })).resolves.toEqual({ value: 1, error: null });
    expect(asked.map((request) => request.kind === 'ask' && [request.options, request.multiple])).toEqual([
      [['Sword', 'Shield', 'Bow'], false], [['Sword', 'Shield', 'Bow'], true],
    ]);
  });

  it('answers confirm with a boolean, input with the typed text, and tell and toast with nothing', async () => {
    const { prompts, asked } = host((request) => (request.kind === 'confirm' ? true : request.kind === 'input' ? 'Ada' : undefined));
    const code = `
      player.tell('Welcome');
      player.toast('Saved');
      const sure = player.confirm('Sure?');
      const name = player.input('Name?', 'Type a name');
      return sure === true && name === 'Ada' ? 1 : 0;`;
    await expect(executeStatCode(code, [], makeStat({}), { prompts })).resolves.toEqual({ value: 1, error: null });
    expect(asked).toEqual([
      { kind: 'tell', text: 'Welcome' },
      { kind: 'toast', text: 'Saved' },
      { kind: 'confirm', question: 'Sure?' },
      { kind: 'input', question: 'Name?', placeholder: 'Type a name' },
    ]);
  });

  it('does not time out while a prompt is held open past one second, and still times out a loop after the answer', async () => {
    const { prompts } = host(() => true, 1300);
    // Enough work after the answer to reach the interrupt check, which fires every so many instructions.
    const work = 'let n = 0; for (let i = 0; i < 300000; i++) n += i % 3;';
    await expect(executeStatCode(`const ok = player.confirm("Wait?"); ${work} return ok && n > 0 ? 5 : 0;`, [], makeStat({}), { prompts }))
      .resolves.toEqual({ value: 5, error: null });
    const result = await executeStatCode('player.confirm("Wait?"); while (true) {}', [], makeStat({}), { prompts });
    expect(result).toMatchObject({ value: null, kind: 'timeout' });
  });

  it('fails the script as canceled when the player closes the prompt, and lands no write', async () => {
    const prompts: ScriptPromptHost = { prompt: () => Promise.reject(new PromptCanceled()) };
    const health = makeStat({ id: 'h', name: 'Health', value: 70 });
    const code = `stats.Health.value = 1; self.value = 2; const pick = player.ask('Door?', ['Left']); return 3;`;
    const result = await executeStatCode(code, [health], makeStat({ id: 'me', name: 'Mood' }), { prompts });
    expect(result).toEqual({ value: null, error: 'The player closed the prompt', kind: 'canceled' });
  });

  it('stays canceled when the script catches the cancel and returns anyway', async () => {
    const prompts: ScriptPromptHost = { prompt: () => Promise.reject(new PromptCanceled()) };
    const code = `try { player.confirm('Sure?'); } catch (e) {} return 9;`;
    await expect(executeStatCode(code, [], makeStat({}), { prompts })).resolves.toMatchObject({ value: null, kind: 'canceled' });
  });

  it('cancels at once through the default store when nothing listens', async () => {
    await expect(executeStatCode('return player.confirm("Sure?") ? 1 : 0;', [], makeStat({})))
      .resolves.toMatchObject({ value: null, kind: 'canceled' });
    await expect(executeStatCode('player.tell("Hi"); return 2;', [], makeStat({}))).resolves.toEqual({ value: 2, error: null });
  });

  it('throws a TypeError in the script for bad arguments, which fails the run as a throw', async () => {
    const { prompts, asked } = host(() => 0);
    const cases = [
      `player.ask('Door?', [])`,
      `player.ask('Door?', ['Left', 5])`,
      `player.ask(7, ['Left'])`,
      `player.confirm()`,
      `player.input('Name?', 3)`,
      `player.tell({ text: 'Hi' })`,
    ];
    for (const call of cases) {
      const result = await executeStatCode(`${call}; return 1;`, [], makeStat({}), { prompts });
      expect(result, call).toMatchObject({ value: null, kind: 'throw' });
      expect(result.error, call).toMatch(/Error: player\./);
      const caught = await executeStatCode(`try { ${call}; } catch (e) { return e instanceof TypeError ? 1 : 0; } return 0;`, [], makeStat({}), { prompts });
      expect(caught, call).toEqual({ value: 1, error: null });
    }
    expect(asked).toEqual([]);
  });

  it('has no call under the retired name', async () => {
    const result = await executeStatCode(`return typeof player.input === 'function' && typeof player['ask' + 'Text'] === 'undefined' ? 1 : 0;`, [], makeStat({}), { prompts: host(() => undefined).prompts });
    expect(result).toEqual({ value: 1, error: null });
  });

  it('refuses player.input in a During AI Output script, naming the call and the timing', async () => {
    const { prompts } = host(() => 'x');
    const narration = { sentence: 'A door.', full: 'A door.', index: 0, sent: [], buffered: [] };
    const result = await executeStatCode(`player.input('Name?'); return 1;`, [], makeStat({}), { prompts, narration });
    expect(result.error).toContain("player.input can't run in During AI Output");
  });

  it('fails a During AI Output script that calls player, on the sync engine, naming the timing', async () => {
    const { prompts, asked } = host(() => 0);
    const narration = { sentence: 'A door.', full: 'A door.', index: 0, sent: [], buffered: [] };
    const result = await executeStatCode(`player.ask('Door?', ['Left']); return 1;`, [], makeStat({}), { prompts, narration });
    expect(result).toMatchObject({ value: null, kind: 'throw' });
    expect(result.error).toContain("player.ask can't run in During AI Output");
    expect(engineRan()).toBe('sync');
    expect(asked).toEqual([]);
  });

  it('reports a host failure other than a cancel as a throw with its message', async () => {
    const prompts: ScriptPromptHost = { prompt: () => Promise.reject(new Error('no screen')) };
    const result = await executeStatCode(`player.confirm('Sure?'); return 1;`, [], makeStat({}), { prompts });
    expect(result).toMatchObject({ value: null, kind: 'throw' });
    expect(result.error).toContain('no screen');
  });

  it('takes two prompting scripts in turn on the one async module', async () => {
    const { prompts, asked } = host((request) => (request.kind === 'ask' ? 0 : 1), 20);
    const [a, b] = await Promise.all([
      executeStatCode(`return player.ask('A?', ['x']) === 'x' ? 1 : 0;`, [], makeStat({}), { prompts }),
      executeStatCode(`return player.ask('B?', ['y']) === 'y' ? 2 : 0;`, [], makeStat({}), { prompts }),
    ]);
    expect([a, b]).toEqual([{ value: 1, error: null }, { value: 2, error: null }]);
    expect(asked.map((request) => request.kind === 'ask' && request.question)).toEqual(['A?', 'B?']);
  });

  it('answers through the store the UI subscribes to', async () => {
    const store = createScriptPromptStore();
    store.subscribe(() => {
      const [open] = store.pending();
      if (open) queueMicrotask(() => store.answer(open.id, 1));
    });
    const code = `return player.ask('Door?', ['Left', 'Right']) === 'Right' ? 1 : 0;`;
    await expect(executeStatCode(code, [], makeStat({}), { prompts: store })).resolves.toEqual({ value: 1, error: null });
    expect(store.pending()).toEqual([]);
  });
});
