import { editorGateInput } from '@/lib/owners';
import { startingGateStats } from '@/lib/gateStats';
import { bindOwnedTraits, type TraitWorld } from '@/lib/portableTraits';
import type { GateInput } from '@/lib/traitGates';
import { openingPickGroups } from '@/lib/testBench/openingPick';
import type { Daypart, Entity, Placeholder, WorldWeather } from '@/types';

const NO_WORLD: TraitWorld = { traits: [], traitGroups: [], entities: [] };

/** The world a library entity's editor was opened from: what its links and requirements read. */
export type LibraryEditorWorld = TraitWorld & {
  placeholders: readonly Placeholder[];
  /** The world's Weather block and Default Time, which a weather or time Condition reads, as the World Editor reads them (Q31). */
  weather?: WorldWeather;
  defaultTime?: Daypart;
};

/**
 * What a library entity's rules read: its own traits and stats beside the world it was opened from. Standalone,
 * "playing as" itself resolves and an outward requirement reads by its stored name. Only the entity's own stats
 * are offered, so the world's stats stay out. An Opening Condition offers the entity's own Openings and reads none drawn.
 */
export function libraryGateInput(entity: Entity, world: LibraryEditorWorld | null): GateInput {
  return editorGateInput({
    traits: world?.traits ?? [], traitGroups: world?.traitGroups ?? [],
    entities: [...(world?.entities ?? []).filter((e) => e.id !== entity.id), bindOwnedTraits(entity, world ?? NO_WORLD)],
    ...(world?.options ? { options: world.options } : {}),
    ...(world?.weather ? { weather: world.weather } : {}),
    ...(world?.defaultTime ? { defaultTime: world.defaultTime } : {}),
    openings: openingPickGroups({ traits: [], traitGroups: [], locations: [], placeholders: world?.placeholders ? [...world.placeholders] : [], stats: [], entities: [entity] }),
  }, startingGateStats({ entities: [entity] }));
}
