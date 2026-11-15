/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxMemory } from './statCodeExecutor';
import { withWorldWrites } from './chainedWorld';
import type { SandboxState } from './statCodeTurn';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const entry = (id: string, fields: Partial<SandboxMemory> = {}): SandboxMemory => ({
  id, turn: 2, timestamp: 12, day: 1, daypart: 'night', text: `Memory ${id}.`,
  custom: false, kept: true, inContext: false, pinned: false, forgotten: false, ...fields,
});

const memories: SandboxMemory[] = [
  entry('t1'),
  entry('named:t1:nursery', { custom: true, name: 'Nursery', text: 'Ash lives at the nursery.' }),
  entry('n1', { custom: true }),
];

const run = (code: string, list: readonly SandboxMemory[] = memories) => executeStatCode(code, [health], health, { memories: list });

describe('executeStatCode named memories', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads a memory by its name, trimmed and case-insensitive', async () => {
    const res = await run(`
      return memories['NURSERY'].text === 'Ash lives at the nursery.' && memories[' nursery '].id === 'named:t1:nursery'
        && memories.Nursery.name === 'Nursery' ? 1 : 0;`);
    expect(res.value).toBe(1);
  });

  it('reads an empty name on an unnamed memory', async () => {
    expect((await run('return memories[0].name === "" && memories[2].name === "" ? 1 : 0;')).value).toBe(1);
  });

  it('reads an unknown name as a blank entry that never throws', async () => {
    const res = await run(`
      const m = memories['Stable'];
      m.edit('x'); m.remove(); m.pin(); m.forget();
      return m.id === '' && m.name === '' && m.text === '' && !m.custom && !m.kept && !m.inContext && !m.pinned && !m.forgotten ? 1 : 0;`);
    expect(res.error).toBeNull();
    expect(res.value).toBe(1);
    expect(res.worldWrites).toBeUndefined();
    expect(res.readOnlyWrites).toEqual(['memories["Stable"].edit()', 'memories["Stable"].remove()', 'memories["Stable"].pin()', 'memories["Stable"].forget()']);
  });

  it('keeps list reads as they were', async () => {
    const res = await run('return memories.length === 3 && memories[5] === undefined && memories.filter((m) => m.custom).length === 2 ? 1 : 0;');
    expect(res.value).toBe(1);
  });

  it('records a named pin, trimmed, beside an unnamed one', async () => {
    const res = await run('memories.pin(" Nursery ", " Ash and Bree. "); memories.pin("The bridge is out."); return 0;');
    expect(res.worldWrites).toEqual({ pins: ['The bridge is out.'], namedPins: [{ name: 'Nursery', text: 'Ash and Bree.' }] });
  });

  it('takes a name that differs from a list member only in case', async () => {
    const res = await run('memories.pin("Length", "Long."); return 0;');
    expect(res.worldWrites).toEqual({ namedPins: [{ name: 'Length', text: 'Long.' }] });
  });

  const typeError = async (code: string) => {
    const res = await run(`try { ${code} } catch (e) { return e instanceof TypeError ? 1 : 2; } return 0;`);
    expect(res.value, code).toBe(1);
  };

  it('throws a TypeError for a blank or non-text name or text', async () => {
    await typeError('memories.pin("  ", "Ash.");');
    await typeError('memories.pin("Nursery", "  ");');
    await typeError('memories.pin(3, "Ash.");');
    await typeError('memories.pin("Nursery", 3);');
    await typeError('memories.pin("Nursery", undefined);');
  });

  it('throws a TypeError for a name that is a list member or an index', async () => {
    for (const name of ['length', ' filter ', 'at', 'map', 'pin', 'append', 'constructor', '3']) {
      await typeError(`memories.pin(${JSON.stringify(name)}, "Ash.");`);
    }
  });

  it('reads a named pin under its name in a later script of the same turn', async () => {
    const state = { memories, turn: { id: 't2', number: 2 }, clock: { deltaHours: 1, elapsedHours: 13 } } as unknown as SandboxState;
    const replaced = withWorldWrites(state, { namedPins: [{ name: 'nursery', text: 'Ash and Bree.' }] });
    const added = withWorldWrites(replaced, { namedPins: [{ name: 'Stable', text: 'Dot.' }, { name: 'Stable', text: 'Dot and Eve.' }] });
    const res = await run(`
      return memories.Nursery.text === 'Ash and Bree.' && memories.Nursery.id === 'named:t1:nursery'
        && memories.Stable.text === 'Dot and Eve.' && memories.length === 4 ? 1 : 0;`, added.memories);
    expect(res.value).toBe(1);
  });
});
