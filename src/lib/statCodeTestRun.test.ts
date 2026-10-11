/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTestCode, statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import { statCodeNamed } from '@/lib/statCodeNames';
import type { Stat } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const luck: Stat = { id: 'l', name: 'Luck', type: 'number', description: '', min: 0, max: 10, value: 3, regen: 1, descriptors: [] };
const world: StatCodeWorld = {
  stats: [health], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
};
const hubWorld: StatCodeWorld = { ...world, stats: [health, luck] };

describe('runTestCode bound writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists a bound the run wrote', async () => {
    const report = await runTestCode('self.max = 60;', 'after', health, statCodeNames(world));
    expect(report.error).toBeNull();
    expect(report.writes).toHaveLength(1);
  });

  it.each(['value', 'min', 'max', 'regen'])('fails on null written to self.%s and lists no writes', async (field) => {
    const report = await runTestCode(`self.max = 60; self.${field} = null;`, 'after', health, statCodeNames(world));
    expect(report.error).toContain(`self.${field} must be`);
    expect(report.writes).toEqual([]);
  });
});

describe('runTestCode writes to other stats', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists each write to another stat with its stat name, field and number, beside the box’s own', async () => {
    const code = 'self.max = 60; stats.Luck.value += 2; stats.Luck.max = 12; stats["Luck"].regen = 0.5; return 40;';
    const report = await runTestCode(code, 'after', health, statCodeNames(hubWorld));
    expect(report.error).toBeNull();
    expect(report.value).toBe(40);
    expect(report.writes).toEqual([
      'Max: 60', 'stats.Luck.value = 5', 'stats.Luck.max = 12', 'stats.Luck.regen = 0.5',
    ]);
    expect(report.dropped).toEqual([]);
  });

  it('lists a bound written to the value it already holds, as any bound assignment is a write', async () => {
    const report = await runTestCode('stats.Luck.max = 10;', 'after', health, statCodeNames(hubWorld));
    expect(report.writes).toEqual(['stats.Luck.max = 10']);
  });

  it('names a stat with a space in its name the way code reaches it', async () => {
    const vision: Stat = { ...luck, id: 'v', name: 'Night Vision' };
    const report = await runTestCode('stats["Night Vision"].value = 9;', 'after', health, statCodeNames({ ...world, stats: [health, vision] }));
    expect(report.writes).toEqual(['stats["Night Vision"].value = 9']);
  });

  it('seeds an entity stat’s run with its owner’s stats at their starting values and lists writes to them', async () => {
    const owner = statCodeNamed([{ ...health, id: 'x', name: 'Hub' }, luck, { ...health, id: 'w', name: 'Wounds', value: 4, max: 8 }], []);
    const report = await runTestCode(
      'stats.Wounds.value += 1; stats.Luck.value = stats.Luck.value * 2;', 'after', owner[0],
      { ...statCodeNames(world), codeNamedStats: owner },
    );
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['stats.Luck.value = 6', 'stats.Wounds.value = 5']);
  });

  it('applies nothing to the authored world', async () => {
    const before = JSON.stringify(hubWorld);
    await runTestCode('self.max = 60; stats.Luck.value = 9; stats.Luck.max = 99; return 1;', 'after', health, statCodeNames(hubWorld));
    expect(JSON.stringify(hubWorld)).toBe(before);
    expect(luck).toMatchObject({ value: 3, max: 10, regen: 1 });
  });

  it('drops and names a write to a stat that does not exist, and to one a trait switched off', async () => {
    const off: Stat = { ...luck, id: 'o', name: 'Dusk', enabled: false };
    const report = await runTestCode(
      'stats.Helth.value = 1; stats.Dusk.value = 2; stats.Luck.value = 4;', 'after', health,
      statCodeNames({ ...world, stats: [health, luck, off] }),
    );
    expect(report.writes).toEqual(['stats.Luck.value = 4']);
    expect(report.dropped).toEqual([
      'Unknown stat names. Writes ignored: stats.Helth.value.',
      'Switched-off stats. Writes ignored: stats.Dusk.value.',
    ]);
  });
});
