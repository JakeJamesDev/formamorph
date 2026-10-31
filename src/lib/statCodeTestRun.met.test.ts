/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { benchSnapshotOf } from './testBench/scriptCheck';
import type { Entity, Stat, World } from '@/types';

const entity = (id: string, over: Partial<Entity> = {}): Entity => ({ id, name: id, description: '', locations: [], ...over }) as Entity;
const hero = entity('hero', { name: 'Hero', persona: true });
const friend = entity('friend', { name: 'Friend', strangerName: 'a stranger', relationships: [{ targetId: 'hero', label: 'friend' }] });
const guard = entity('guard', { name: 'Guard', strangerName: 'a guard' });
const smith = entity('smith', { name: 'Smith' });

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [hero, friend, guard, smith], entityGroups: [], placeholders: [],
  placeholderGroups: [], dictionaries: [], locations: [{ id: 'inn', name: 'Inn', isStarting: true }],
};
const persona = { ref: { source: 'world', entityId: 'hero' } } as const;

const STAT_HOME = { kind: 'globalStat', stat: { id: 's', name: 'S' } as Stat } as const;
const metOf = (name: string) => `return entities.${name}.met ? 1 : 0;`;

describe('met in a script run reads the Presence start rule', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('meets a stranger tied to the persona by a relationship, in a Test Run', async () => {
    const report = await runTestCode(metOf('Friend'), 'after', STAT_HOME, world, { persona });
    expect(report.error).toBeNull();
    expect(report.value).toBe(1);
  });

  it('meets a stranger tied to the persona by a relationship, in a Tool', async () => {
    // A Tool returns no value, so an unmet Friend fails the run.
    const code = 'if (!entities.Friend.met) throw new Error("Friend is unmet");';
    expect((await runTestCode(code, 'after', { kind: 'tool' }, world, { persona })).error).toBeNull();
    expect((await runTestCode(code, 'after', { kind: 'tool' }, world)).error).not.toBeNull();
  });

  it('keeps a stranger with no tie unmet under a persona', async () => {
    const report = await runTestCode(metOf('Guard'), 'after', STAT_HOME, world, { persona });
    expect(report.value).toBe(0);
  });

  it('applies the start rule with no persona: only an entity with no Stranger Name is met', async () => {
    expect((await runTestCode(metOf('Friend'), 'after', STAT_HOME, world)).value).toBe(0);
    expect((await runTestCode(metOf('Smith'), 'after', STAT_HOME, world)).value).toBe(1);
  });

  it('meets the tied stranger in the Test Bench snapshot under the persona', async () => {
    const snapshot = benchSnapshotOf({ ...world, worldOverview: { name: 'Test', description: '', systemPrompt: '' } as World['worldOverview'], statUpdates: [], locations: world.locations ?? [] }, 'after', persona);
    const out = await snapshot.run({ home: STAT_HOME, timing: 'after', code: metOf('Friend') });
    expect(out.error).toBeNull();
    expect(out.value).toBe(1);
  });
});
