import { editorGateInput } from '@/lib/owners';
import { startingGateStats } from '@/lib/gateStats';
import { bindOwnedTraits, type TraitWorld } from '@/lib/portableTraits';
import type { GateInput } from '@/lib/traitGates';
import type { Entity, Placeholder } from '@/types';

const NO_WORLD: TraitWorld = { traits: [], traitGroups: [], entities: [] };

/** The world a library entity's editor was opened from: what its links and requirements read. */
export type LibraryEditorWorld = TraitWorld & { placeholders: readonly Placeholder[] };

/**
 * What a library entity's rules read: its own traits and stats beside the world it was opened from. Standalone,
 * "playing as" itself resolves and an outward requirement reads by its stored name. Only the entity's own stats
 * are offered, so the world's stats stay out.
 */
export function libraryGateInput(entity: Entity, world: LibraryEditorWorld | null): GateInput {
  return editorGateInput({
    traits: world?.traits ?? [], traitGroups: world?.traitGroups ?? [],
    entities: [...(world?.entities ?? []).filter((e) => e.id !== entity.id), bindOwnedTraits(entity, world ?? NO_WORLD)],
  }, startingGateStats({ entities: [entity] }));
}
