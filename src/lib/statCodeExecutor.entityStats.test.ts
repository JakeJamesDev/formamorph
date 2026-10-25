/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, type SandboxEntity } from './statCodeExecutor';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

const trust = makeStat({ id: 't', name: 'Trust', value: 40 });
const stock = makeStat({ id: 'k', name: 'Stock', value: 12, max: 30, regen: 2 });
const bram: SandboxEntity = {
  id: 'bram', name: 'Bram', traits: [],
  stats: {
    stats: [trust, stock],
    readings: { t: { previous: { ...trust, value: 55 }, delta: { regen: { value: 0 } } } },
    enabled: { k: false },
  },
};

const run = (code: string, entities: SandboxEntity[] = [bram]) =>
  executeStatCode(code, [makeStat({ id: 'p', name: 'P' })], makeStat({ id: 'p', name: 'P' }), { entities });

describe('executeStatCode entities[x].stats', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads an entity’s stats by name, with the fields a stats entry has', async () => {
    const out = await run('return entities.Bram.stats.Trust.value + entities.Bram.stats.Stock.max;');
    expect(out.value).toBe(70);
  });

  it('carries each entry’s previous and delta, as a stats entry does', async () => {
    const out = await run('return entities.Bram.stats.Trust.previous.value + 2 * entities.Bram.stats.Trust.delta.actual.value;');
    // 55 at turn start, 40 now.
    expect(out.value).toBe(55 - 30);
  });

  it('lists a switched-off stat with enabled false', async () => {
    const out = await run('return (entities.Bram.stats.Stock.enabled ? 1 : 0) + (entities.Bram.stats.Trust.enabled ? 10 : 0);');
    expect(out.value).toBe(10);
  });

  it('returns a write to an entity’s stat keyed by its id, and reports its read-only fields', async () => {
    const out = await run('entities.Bram.stats.Trust.value = 99; entities.Bram.stats.Trust.previous.value = 1; return entities.Bram.stats.Trust.value;');
    expect(out.value).toBe(99);
    expect(out.ownerStatWrites).toEqual([{ ownerId: 'bram', writes: [{ id: 't', name: 'Trust', value: 99 }] }]);
    expect(out.readOnlyWrites).toEqual(['entities.Bram.stats.Trust.previous.value']);
    expect(out.statWrites).toBeUndefined();
  });

  it.each(['value', 'min', 'max', 'regen'])('returns a write to %s through the persona’s stats, keyed by its id', async (field) => {
    const persona: SandboxEntity = { id: 'mira', name: '', traits: [], stats: { stats: [trust] } };
    const out = await executeStatCode(`persona.stats.Trust.${field} = 3;`, [trust], makeStat({ id: 'p', name: 'P' }), { persona });
    expect(out).toEqual({ value: null, error: null, ownerStatWrites: [{ ownerId: 'mira', writes: [{ id: 't', name: 'Trust', [field]: 3 }] }] });
  });

  it('drops a write through the empty persona’s stats and reports it', async () => {
    const out = await executeStatCode('persona.stats.Trust.value = 3;', [trust], makeStat({ id: 'p', name: 'P' }));
    expect(out).toEqual({ value: null, error: null, unknownStatWrites: ['persona.stats.Trust.value'] });
  });

  it('drops a write through a persona with no id, which no owner stands behind, and reports it', async () => {
    const persona: SandboxEntity = { name: '', traits: [], stats: { stats: [trust] } };
    const out = await executeStatCode('persona.stats.Trust.max = 3;', [trust], makeStat({ id: 'p', name: 'P' }), { persona });
    expect(out).toEqual({ value: null, error: null, unknownStatWrites: ['persona.stats.Trust.max'] });
  });

  it('fails the run on a write that is not a finite number, discarding every write', async () => {
    const out = await run('stats.P.max = 50; entities.Bram.stats.Trust.regen = null;');
    expect(out).toMatchObject({ value: null, kind: 'non-number', error: expect.stringContaining('entities.Bram.stats.Trust.regen must be a finite number') });
    expect(out.statWrites).toBeUndefined();
  });

  it('drops a write to a switched-off stat, an unknown stat and an absent entity, each by its full path', async () => {
    const out = await run('entities.Bram.stats.Stock.value = 1; entities.Bram.stats.Nope.max = 2; entities.Ghost.stats.Trust.regen = 3;'
      + ' entities["Old Rook"].stats.Trust.value = 4;');
    expect(out).toEqual({
      value: null, error: null,
      disabledStatWrites: ['entities.Bram.stats.Stock.value'],
      unknownStatWrites: ['entities.Bram.stats.Nope.max', 'entities.Ghost.stats.Trust.regen', 'entities["Old Rook"].stats.Trust.value'],
    });
  });

  it('keeps the stats map and a whole entry read only', async () => {
    const out = await run('entities.Bram.stats = {}; entities.Bram.stats.Trust = 3;');
    expect(out).toEqual({ value: null, error: null, readOnlyWrites: ['entities.Bram.stats.Trust', 'entities.Bram.stats'] });
  });

  it('reads an unknown stat, and every stat of an entity with none, as a blank entry', async () => {
    const out = await run('const a = entities.Bram.stats.Nope; const b = entities.Ghost.stats.Trust;'
      + ' return a.value + b.value + (a.enabled || b.enabled ? 1 : 0) + (entities.Rook.stats.Trust.name === "" ? 7 : 0);',
    [bram, { id: 'rook', name: 'Rook', traits: [] }]);
    expect(out.value).toBe(7);
  });
});
