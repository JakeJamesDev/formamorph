/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { openingPersonaOf } from './openingState';
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
const benchRun = (code: string, options: Parameters<typeof benchSnapshotOf>[2], on: StatCodeWorld = world) =>
  benchSnapshotOf({ ...on, worldOverview: { name: 'Test', description: '', systemPrompt: '' } as World['worldOverview'], statUpdates: [], locations: on.locations ?? [] }, 'after', options)
    .run({ home: STAT_HOME, timing: 'after', code });

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
    const out = await benchRun(metOf('Friend'), { persona });
    expect(out.error).toBeNull();
    expect(out.value).toBe(1);
  });

  describe('a library persona', () => {
    // The library persona lives in no world, so only the opening persona carries it to the fold.
    const traveler = entity('traveler', { name: 'Traveler', persona: true });
    const kin = entity('kin', { name: 'Kin', strangerName: 'a stranger', relationships: [{ targetId: 'traveler', label: 'sibling' }] });
    const libraryWorld: StatCodeWorld = { ...world, entities: [kin, guard] };
    const ref = { source: 'library', entityId: 'traveler' } as const;

    it('meets a stranger tied to it, in the Test Bench snapshot', async () => {
      const out = await benchRun(metOf('Kin'), { persona: openingPersonaOf(ref, { libraryEntity: traveler }) }, libraryWorld);
      expect(out.value).toBe(1);
    });

    it('meets a stranger tied to it, in a Test Run', async () => {
      const report = await runTestCode(metOf('Kin'), 'after', STAT_HOME, libraryWorld, { persona: openingPersonaOf(ref, { libraryEntity: traveler }) });
      expect(report.value).toBe(1);
    });

    it('leaves the tied stranger unmet when the library entity is not given', async () => {
      expect((await benchRun(metOf('Kin'), { persona: openingPersonaOf(ref) }, libraryWorld)).value).toBe(0);
    });
  });

  describe('openingPersonaOf', () => {
    const traveler = entity('traveler');
    it('is None without a reference', () => expect(openingPersonaOf(null, { libraryEntity: traveler })).toBeUndefined());
    it('carries the library entity only for a library reference', () => {
      expect(openingPersonaOf({ source: 'library', entityId: 'traveler' }, { libraryEntity: traveler })?.libraryEntity).toBe(traveler);
      expect(openingPersonaOf({ source: 'world', entityId: 'hero' }, { libraryEntity: traveler })).toEqual({ ref: { source: 'world', entityId: 'hero' } });
    });
  });
});
