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
    turn: { t: { previous: { ...trust, value: 55 }, delta: { regen: { value: 0 } } } },
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

  it('drops a write to an entity’s stat and reports it as a read-only write', async () => {
    const out = await run('entities.Bram.stats.Trust.value = 99; entities.Bram.stats.Trust.previous.value = 1; return entities.Bram.stats.Trust.value;');
    expect(out.value).toBe(40);
    expect(out.readOnlyWrites).toEqual(['entities.Bram.stats.Trust.value', 'entities.Bram.stats.Trust.previous.value']);
    expect(out.statWrites).toBeUndefined();
  });

  it.each(['value', 'min', 'max', 'regen'])('drops a write to %s through the empty persona’s stats and reports it', async (field) => {
    const persona: SandboxEntity = { name: '', traits: [], stats: { stats: [trust] } };
    const out = await executeStatCode(`persona.stats.Trust.${field} = 3;`, [trust], makeStat({ id: 'p', name: 'P' }), { persona });
    expect(out).toEqual({ value: null, error: null, readOnlyWrites: [`persona.stats.Trust.${field}`] });
  });

  it('keeps the stats map itself read only', async () => {
    const out = await run('entities.Bram.stats = {}; entities.Bram.stats.Trust = 3; return entities.Bram.stats.Trust.value;');
    expect(out.value).toBe(40);
    expect(out.readOnlyWrites).toEqual(['entities.Bram.stats']);
  });

  it('reads an unknown stat, and every stat of an entity with none, as a blank entry', async () => {
    const out = await run('const a = entities.Bram.stats.Nope; const b = entities.Ghost.stats.Trust;'
      + ' return a.value + b.value + (a.enabled || b.enabled ? 1 : 0) + (entities.Rook.stats.Trust.name === "" ? 7 : 0);',
    [bram, { id: 'rook', name: 'Rook', traits: [] }]);
    expect(out.value).toBe(7);
  });
});
