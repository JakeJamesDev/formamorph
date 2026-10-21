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

const entry = (id: string, turn: number, daypart: string, fields: Partial<SandboxMemory> = {}): SandboxMemory => ({
  id, turn, timestamp: turn * 6, day: 1 + Math.floor(turn / 4), daypart, text: `Memory ${id}.`,
  custom: false, kept: true, inContext: false, pinned: false, forgotten: false, ...fields,
});

const memories: SandboxMemory[] = [
  entry('t1', 1, 'morning'),
  entry('t2', 2, 'night', { pinned: true }),
  entry('n1', 2, 'night', { custom: true, inContext: true }),
  entry('t3', 3, 'afternoon', { forgotten: true, kept: false }),
];

/** A stat run over `memories`: its return value is the read. */
const read = (code: string, list: readonly SandboxMemory[] = memories) => executeStatCode(code, [health], health, { memories: list });

describe('executeStatCode memories', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads every entry oldest first with its fields', async () => {
    const fields = await read(`
      const first = memories[0], line = memories[2];
      return memories.length === 4 && first.id === 't1' && first.turn === 1 && first.timestamp === 6 && first.day === 1
        && first.daypart === 'morning' && first.text === 'Memory t1.' && first.kept && !first.inContext
        && memories[1].pinned && !memories[1].forgotten && memories[3].forgotten && !memories[3].kept
        && line.custom && line.inContext && memories.map((m) => m.id).join() === 't1,t2,n1,t3' ? 1 : 0;`);
    expect(fields.value).toBe(1);
  });

  it('filters by daypart', async () => {
    expect((await read('return memories.filter((m) => m.daypart === "night").length;')).value).toBe(2);
  });

  it('reads an empty array when the run passes none', async () => {
    expect((await executeStatCode('return memories.length;', [health], health)).value).toBe(0);
  });

  it('never reads back a line the run added', async () => {
    const res = await read('memories.add("Seen."); memories.pin("Kept."); return memories.length;');
    expect(res.value).toBe(4);
    expect(res.worldWrites).toEqual({ memory: ['Seen.'], pins: ['Kept.'] });
  });

  it('lists a write to an entry field as read-only and keeps the field', async () => {
    const res = await read('memories[0].text = "Changed."; memories[1].pinned = false; return memories[0].text === "Memory t1." ? 1 : 0;');
    expect(res.value).toBe(1);
    expect(res.readOnlyWrites).toEqual(['memories[0].text', 'memories[1].pinned']);
  });

  it('cannot grow or replace the list', async () => {
    expect((await read('try { memories.push(memories[0]); } catch {} memories[0] = null; return memories.length + (memories[0] ? 10 : 0);')).value).toBe(14);
  });

  it('names the new call in a bad line’s error', async () => {
    expect((await read('memories.add(" ");')).error).toMatch(/memories\.add needs a line as text/);
    expect((await read('memories.pin(5);')).error).toMatch(/memories\.pin needs a line as text/);
  });

  it('carries only the entry fields into a run over 400 rows, whatever else a caller holds', async () => {
    const held = Array.from({ length: 400 }, (_, i) => ({
      ...entry(`t${i}`, i + 1, 'night'), original: `ORIGINAL ${'x'.repeat(200)}`, importance: 3,
    }));
    const res = await read(`const text = JSON.stringify(memories);
      return Object.keys(memories[0]).length === 11 && !text.includes('ORIGINAL') && !text.includes('importance') ? text.length : -1;`, held);
    expect(res.value).toBeGreaterThan(0);
    expect(res.value).toBeLessThan(400 * 170);
  });

  it('has no `memory` alias', async () => {
    const res = await read('memory.add("Old.");');
    expect(res.kind).toBe('throw');
    expect(res.error).toMatch(/memory/);
    expect(res.worldWrites).toBeUndefined();
  });
});
