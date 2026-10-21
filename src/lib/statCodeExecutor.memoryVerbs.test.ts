/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxMemory } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const entry = (id: string, fields: Partial<SandboxMemory> = {}): SandboxMemory => ({
  id, turn: 1, timestamp: 6, day: 1, daypart: 'morning', text: `Memory ${id}.`,
  custom: false, kept: true, inContext: false, pinned: false, forgotten: false, ...fields,
});

const memories: SandboxMemory[] = [entry('t1'), entry('t2'), entry('n1', { custom: true }), entry('t3')];

const run = (code: string) => executeStatCode(code, [health], health, { memories });

describe('executeStatCode memory entry verbs', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('collects pin, forget, edit and remove in call order, by row id', async () => {
    const res = await run('memories[0].forget(); memories[1].pin(); memories[3].edit("  Rewritten.  "); memories[3].remove();');
    expect(res.error).toBeNull();
    expect(res.worldWrites?.memoryWrites).toEqual([
      { id: 't1', kind: 'forget' },
      { id: 't2', kind: 'pin' },
      { id: 't3', kind: 'edit', text: 'Rewritten.', custom: false },
      { id: 't3', kind: 'remove' },
    ]);
  });

  it('never reads a verb back within the run', async () => {
    const res = await run('memories[0].forget(); memories[0].edit("New."); memories[0].remove();'
      + 'return !memories[0].forgotten && memories[0].text === "Memory t1." && memories.length === 4 ? 1 : 0;');
    expect(res.value).toBe(1);
  });

  it('drops pin and forget on a Custom line and lists each as a dropped write', async () => {
    const res = await run('memories[2].pin(); memories[2].forget(); memories[2].pin();');
    expect(res.error).toBeNull();
    expect(res.worldWrites).toBeUndefined();
    expect(res.readOnlyWrites).toEqual(['memories[2].pin()', 'memories[2].forget()']);
  });

  it('edits and removes a Custom line', async () => {
    const res = await run('memories[2].edit("The bridge is fixed."); memories[2].remove();');
    expect(res.worldWrites?.memoryWrites).toEqual([
      { id: 'n1', kind: 'edit', text: 'The bridge is fixed.', custom: true },
      { id: 'n1', kind: 'remove' },
    ]);
    expect(res.readOnlyWrites).toBeUndefined();
  });

  it('forgets across the whole list, the Custom line ignored and listed', async () => {
    const res = await run('for (const m of memories) m.forget();');
    expect(res.worldWrites?.memoryWrites?.map((write) => write.id)).toEqual(['t1', 't2', 't3']);
    expect(res.readOnlyWrites).toEqual(['memories[2].forget()']);
  });

  it('fails an edit with no text, naming the entry', async () => {
    const res = await run('memories[1].edit(" ");');
    expect(res.kind).toBe('throw');
    expect(res.error).toMatch(/memories\[1\]\.edit needs a line as text/);
  });

  it('keeps the verbs out of the entry’s fields and lists an overwrite as read-only', async () => {
    const res = await run('memories[0].pin = null; return Object.keys(memories[0]).includes("pin") || typeof memories[0].pin !== "function" ? 0 : 1;');
    expect(res.value).toBe(1);
    expect(res.readOnlyWrites).toEqual(['memories[0].pin']);
  });
});
