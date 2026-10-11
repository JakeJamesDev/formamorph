/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTestCode, statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import type { Stat } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const world: StatCodeWorld = {
  stats: [health], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
};

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
