import { createContext, useContext, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { editorGateInput } from '@/lib/owners';
import { startingGateStats } from '@/lib/gateStats';
import type { GateInput } from '@/lib/traitGates';
import type { PinEditorWorld } from '@/lib/placeholderPins';
import type { PlacementLetters } from '@/lib/placementLetters';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import type { Entity, Placeholder, Stat, StatGroup, Trait, TraitGroup } from '@/types';

/**
 * The trait CRUD the trait-editing widgets need. The World Editor binds it to the world; a library entity
 * binds it to that entity's own traits, which then fill the tree's root.
 */
export interface TraitStore {
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** The entities whose nodes the tree shows. */
  entities: Entity[];
  placeholders: Placeholder[];
  stats: Stat[];
  /** The world's stat groups, so an owner's links and the Blueprints read off them. Absent off-world. */
  statGroups?: StatGroup[];
  placementLetters?: PlacementLetters;
  placeholderOwners?: PlaceholderOwners;
  setTraits: (traits: Trait[]) => void;
  setTraitGroups: (groups: TraitGroup[]) => void;
  updateTrait: (trait: Trait) => void;
  updateTraitGroup: (group: TraitGroup) => void;
  removeTrait: (id: string) => void;
  removeTraitGroup: (id: string) => void;
  editEntity: (id: string, edit: (entity: Entity) => Entity) => void;
  /** Every owner's traits with nothing active: what gates read in the editor. */
  gateInput: GateInput;
  /** What the pin rows read rivals from. Null off-world. */
  pinWorld: PinEditorWorld | null;
  /** Off-world: requirements point only inside the entity, so the picker offers no personas. */
  offWorld?: boolean;
  /** The one entity whose own items fill the tree's root, its links among them. Absent when the root is the world. */
  entityRoot?: EntityRoot;
}

/** The entity at a one-entity tree's root, and the world its links read their originals from. */
export interface EntityRoot {
  /** The entity, its links bound to `world` where they can be. */
  owner: Entity;
  /** The world the editor was opened from, which the links read their originals from; null standalone. */
  world: LinkOriginals & { placeholders: readonly Placeholder[]; stats?: readonly Stat[]; statGroups?: readonly StatGroup[] } | null;
}

/** The world lists a link's original is read from. */
export type LinkOriginals = { traits: readonly Trait[]; traitGroups: readonly TraitGroup[] };

const NO_ORIGINALS: LinkOriginals = { traits: [], traitGroups: [] };

/** The world lists a link's original is read from: the World Editor's own, or the root entity's world. */
export const originalsOf = (store: Pick<TraitStore, 'traits' | 'traitGroups' | 'entityRoot'>): LinkOriginals =>
  (store.entityRoot ? store.entityRoot.world ?? NO_ORIGINALS : store);

export const TraitStoreContext = createContext<TraitStore | null>(null);

/** The trait store in scope: a provided one, else the loaded world's. */
export function useTraitStore(): TraitStore {
  const store = useOptionalTraitStore();
  if (!store) throw new Error('useTraitStore needs a world or a TraitStoreContext');
  return store;
}

/** The trait store in scope, or null where there is neither a provided one nor a world. */
export function useOptionalTraitStore(): TraitStore | null {
  const provided = useContext(TraitStoreContext);
  const world = useGameDataOptional();
  const traits = world?.traits;
  const traitGroups = world?.traitGroups;
  const entities = world?.entities;
  const stats = world?.stats;
  const statGroups = world?.statGroups;
  const gateInput = useMemo(
    () => editorGateInput(
      { traits: traits ?? [], traitGroups: traitGroups ?? [], entities: entities ?? [] },
      startingGateStats({ stats, statGroups, entities: entities ?? [] }),
    ),
    [traits, traitGroups, entities, stats, statGroups],
  );
  if (provided) return provided;
  if (!world) return null;
  return {
    traits: world.traits,
    traitGroups: world.traitGroups,
    entities: world.entities,
    placeholders: world.placeholders,
    stats: world.stats,
    statGroups: world.statGroups,
    placementLetters: world.placementLetters,
    placeholderOwners: world.placeholderOwners,
    setTraits: world.setTraits,
    setTraitGroups: world.setTraitGroups,
    updateTrait: world.updateTrait,
    updateTraitGroup: world.updateTraitGroup,
    removeTrait: world.removeTrait,
    removeTraitGroup: world.removeTraitGroup,
    editEntity: world.editEntity,
    gateInput,
    pinWorld: world,
  };
}
