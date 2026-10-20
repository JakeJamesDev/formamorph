/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import type { Stat, Trait } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const brave: Trait = { id: 'b', name: 'Brave', statChanges: [] };
const world: StatCodeWorld = {
  stats: [health], statGroups: [], traits: [brave], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
};
const BRAVE = { kind: 'trait', trait: brave, entityId: null } as const;

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('Test Code on a trait’s script', () => {
  it('reads self as the trait’s entry, not held in a run with no playthrough', async () => {
    const report = await runTestCode(
      'stats.Health.value = self.name === "Brave" && !self.acquired ? 70 : 10;', 'after', BRAVE, world,
    );
    expect(report.error).toBeNull();
    expect(report.value).toBeNull();
    expect(report.writes).toEqual(['stats.Health.value = 70']);
  });

  it('drops a write to self as read-only, and a return value as nothing', async () => {
    const report = await runTestCode('self.enabled = true; return 5;', 'after', BRAVE, world);
    expect(report.error).toBeNull();
    expect(report.value).toBeNull();
    expect(report.writes).toEqual([]);
    expect(report.dropped).toEqual(['Read-only fields. Writes ignored: self.enabled.']);
  });
});
