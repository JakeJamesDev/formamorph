import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Hint } from '@/components/ui/typography';
import type { EntityRoot, TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import { ownedTraitWrites } from '@/lib/ownedTraits';
import type { Entity } from '@/types';
import EntityTraitsEditor, { type EntityTraitStore } from './EntityTraitsEditor';

/**
 * A trait store over one world entity: its own traits fill the tree's root, every write lands on it through
 * the world's entity edit, and its links read their originals from the world live. It stays on world: gates
 * read every owner, the requirement picker offers personas, and the pin rows read the world's rivals.
 */
function useWorldEntityTraitStore(entity: Entity): EntityTraitStore {
  const world = useGameData();
  const { traits, traitGroups, entities, placeholders, stats, placementLetters, placeholderOwners, editEntity } = world;
  const gateInput = useMemo(
    () => editorGateInput({ traits, traitGroups, entities }),
    [traits, traitGroups, entities],
  );
  return useMemo(() => {
    const edit = (change: (e: Entity) => Entity) => editEntity(entity.id, change);
    const entityRoot: EntityRoot = { bearer: entity, world: { traits, traitGroups, placeholders } };
    const store: TraitStore = {
      traits: entity.traits ?? [],
      traitGroups: entity.traitGroups ?? [],
      entities: [],
      placeholders,
      stats,
      placementLetters,
      placeholderOwners,
      ...ownedTraitWrites(edit),
      editEntity,
      gateInput,
      pinWorld: world,
    };
    return { ...store, entityRoot };
  }, [entity, traits, traitGroups, placeholders, stats, placementLetters, placeholderOwners, editEntity, gateInput, world]);
}

/**
 * The entity panel's Traits tab: the Traits tab's tree, toolbar and panels over one world entity, stacked so
 * a selected trait's details slide in over the list. The World Editor holds the selection, as it holds the
 * panel's tab, since the panel remounts per entity; the editor clears one the entity doesn't hold.
 */
const EntityTraitsMirror = ({ entity, selectedId, onSelect }: {
  entity: Entity;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const store = useWorldEntityTraitStore(entity);
  return (
    <EntityTraitsEditor
      store={store}
      layout="stacked"
      selectedId={selectedId}
      onSelect={onSelect}
      ownerLine={false}
      emptyHint={<Hint className="p-2">Add a trait to give this entity a node on the <strong>Traits</strong> tab</Hint>}
    />
  );
};

export default EntityTraitsMirror;
