import { describe, it, expect } from 'vitest';
import { migrateWorld } from './version';
import { entryDefaults } from './entryDraft';
import { inPlayOwners } from './ownedTraitsInPlay';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import {
  acquireTrait, applyOwnedStatTraits, gateStatsOf, seedNewGameStats, settleTraits, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import type { PersonaRef, PlayerStat, World } from '@/types';

// Every bundled world, loaded the way the seeder loads it.
const worlds = Object.entries(import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true }))
  .map(([file, raw]): [string, World] => [file.split('/').at(-1)!, migrateWorld(JSON.parse(raw))]);
const NONE: PersonaRef = { source: 'none' };

/** The world as Enter World leaves it under no persona: every owner on its default picks, stats seeded. */
function started(world: World): { state: TraitRuntimeState; tw: TraitWorld } {
  const traitGroups = world.traitGroups ?? [];
  const defaults = entryDefaults({ traits: world.traits, traitGroups, entities: world.entities, library: [], stats: world.stats, statGroups: world.statGroups }, NONE);
  const tw: TraitWorld = {
    traits: world.traits, groups: traitGroups, entities: world.entities, persona: NONE,
    ...inPlayOwners({ traits: world.traits, traitGroups, entities: world.entities }, NONE),
  };
  let state: TraitRuntimeState = { stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {} };
  for (const trait of world.traits.filter((t) => defaults.traitIds.includes(t.id))) state = acquireTrait(state, trait, tw).state;
  state = applyOwnedStatTraits({ ...state, ownedTraits: ownedTraitStatesFrom(defaults.ownedTraitIds), entityStats: seedEntityStats(world.entities) }, tw);
  return { state, tw };
}

/** Every stat of every owner at `at` of its span. */
const at = (stats: readonly PlayerStat[], share: number): PlayerStat[] =>
  stats.map((s) => ({ ...s, value: s.min + (s.max - s.min) * share }));
const movedTo = (state: TraitRuntimeState, share: number): TraitRuntimeState => ({
  ...state,
  stats: at(state.stats, share),
  entityStats: Object.fromEntries(Object.entries(state.entityStats ?? {}).map(([id, stats]) => [id, at(stats, share)])),
});

const hasStatConditions = (world: World): boolean =>
  [...world.traits, ...world.entities.flatMap((e) => e.traits ?? [])]
    .flatMap((t) => t.requires ?? []).flatMap((row) => row.all).some((c) => c.kind === 'stat');
// A world with stat Conditions moves its traits with its stats by design; its own world test covers those gates.
const statFree = worlds.filter(([, world]) => !hasStatConditions(world));

describe('the per-turn settle on worlds with no stat Conditions', () => {
  it('still has worlds to check', () => {
    expect(statFree.length).toBeGreaterThan(0);
  });

  it.each(statFree)('leaves %s on the same active set on every commit', (_file, world) => {
    const { state, tw } = started(world);
    for (const share of [0, 1, 0.5, 0.2]) {
      const commit = movedTo(state, share);
      expect(settleTraits(commit, { ...tw, gateStats: gateStatsOf(commit, tw) }).state).toBe(commit);
    }
  });
});
