// The stats setup gates read: the game's opening stats under a set of picks (Q26).

import type { Entity, PersonaRef, Stat, StatGroup, Trait, TraitGroup, WorldOption, WorldOptionValues } from '@/types';
import { seedEntityStats } from './entityStats';
import { inPlayOwners } from './ownedTraitsInPlay';
import { playStatWorld } from './statLinks';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { gateStatsOf, heldGlobalTraits, startingTraitState, type TraitWorld } from './traitRuntime';
import type { GateActive, GateInput, GateStats } from './traitGates';

/** What the setup stats read from a world. */
export interface SetupStatWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  traits?: readonly Trait[];
  traitGroups?: readonly TraitGroup[];
  entities: readonly Entity[];
  options?: readonly WorldOption[];
}

/** What a setup gate input reads a set of picks' stats through. */
export type SetupStatsOf = NonNullable<GateInput['statsOf']>;

const signature = (active: GateActive): string =>
  JSON.stringify([[...active.global].sort(), Object.entries(active.owners).map(([id, ids]) => [id, [...ids].sort()]).sort()]);

/**
 * The stats a new game under `persona` starts with for each set of picks: the Option values' starting rows, the
 * global picks in authored order, then each owner's picks, through the opening's own steps, each stat clamped
 * by the bounds the same picks set. `library` holds the library entities in the cast.
 */
export function setupStatsOf(
  world: SetupStatWorld, persona: PersonaRef, library: readonly Entity[] = [], optionValues?: WorldOptionValues,
): SetupStatsOf {
  const traits = [...(world.traits ?? [])];
  const traitGroups = [...(world.traitGroups ?? [])];
  const resolved = playStatWorld({
    stats: [...(world.stats ?? [])], statGroups: [...(world.statGroups ?? [])], entities: [...world.entities, ...library],
  });
  const entities = resolved.entities.slice(0, world.entities.length);
  const cast = resolved.entities.slice(world.entities.length);
  const traitWorld: TraitWorld = {
    traits, groups: traitGroups, entities, persona, options: [...(world.options ?? [])], ...(optionValues && { optionValues }),
    ...inPlayOwners({ traits, traitGroups, entities }, persona, cast),
  };
  const entityStats = seedEntityStats(resolved.entities);
  const order = traitOrderIndex(traits, traitGroups);
  const cache = new Map<string, GateStats>();
  return (active) => {
    const key = signature(active);
    const hit = cache.get(key);
    if (hit) return hit;
    const chosen = new Set(active.global);
    const held = inAuthoredOrder(heldGlobalTraits(traits.filter((t) => chosen.has(t.id)), traitWorld), order);
    const owned = Object.fromEntries(Object.entries(active.owners).map(([id, ids]) => [id, [...ids]]));
    const { state } = startingTraitState(resolved.stats, held, traitWorld, owned, entityStats);
    const stats = gateStatsOf(state, traitWorld);
    cache.set(key, stats);
    return stats;
  };
}
