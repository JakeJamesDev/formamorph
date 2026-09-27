import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListDetail } from '@/components/ui/list-detail';
import { Hint } from '@/components/ui/typography';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import {
  addOwnedGroup, addOwnedTrait, removeOwnedItem, updateOwnedGroup, updateOwnedTrait, withOwnedTraits,
} from '@/lib/ownedTraits';
import { bindOwnedTraits, type TraitWorld } from '@/lib/portableTraits';
import { randomUUID } from '@/lib/uuid';
import type { TraitPanelTab } from '@/views/traitPanelTabs';
import type { Entity, Placeholder } from '@/types';
import TraitTree from './TraitTree';
import TraitManager from './TraitManager';
import GroupManager from './GroupManager';

const NO_WORLD: TraitWorld = { traits: [], traitGroups: [], entities: [] };

/** A trait store over one library entity: its own traits fill the tree's root, and every write lands on it. */
function libraryTraitStore(entity: Entity, setEntity: Dispatch<SetStateAction<Entity | null>>, placeholders: Placeholder[]): TraitStore {
  const edit = (change: (e: Entity) => Entity) => setEntity((prev) => (prev ? change(prev) : prev));
  const traits = entity.traits ?? [];
  const traitGroups = entity.traitGroups ?? [];
  return {
    traits,
    traitGroups,
    entities: [],
    placeholders,
    stats: [],
    setTraits: (next) => edit((e) => withOwnedTraits(e, next, e.traitGroups ?? [])),
    setTraitGroups: (next) => edit((e) => withOwnedTraits(e, e.traits ?? [], next)),
    updateTrait: (trait) => edit((e) => updateOwnedTrait(e, trait)),
    updateTraitGroup: (group) => edit((e) => updateOwnedGroup(e, group)),
    removeTrait: (id) => edit((e) => removeOwnedItem(e, id)),
    removeTraitGroup: (id) => edit((e) => removeOwnedItem(e, id)),
    editEntity: (id, change) => edit((e) => (e.id === id ? change(e) : e)),
    // Bound to no world, so "playing as" itself resolves and an outward requirement reads by its stored name.
    gateInput: editorGateInput({ traits: [], traitGroups: [], entities: [bindOwnedTraits(entity, NO_WORLD)] }),
    pinWorld: null,
    offWorld: true,
  };
}

/**
 * A library entity's Traits tab: the World Editor's tree and trait panel over the entity's own traits.
 * Requirements can point only inside the entity; one that points out of it reads by its stored name.
 */
const LibraryTraitsEditor = ({ entity, setEntity, placeholders, onOpenEntity }: {
  entity: Entity;
  setEntity: Dispatch<SetStateAction<Entity | null>>;
  placeholders: Placeholder[];
  onOpenEntity: () => void;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TraitPanelTab>('details');
  const store = useMemo(() => libraryTraitStore(entity, setEntity, placeholders), [entity, setEntity, placeholders]);
  const trait = entity.traits?.find((t) => t.id === selectedId);
  const group = entity.traitGroups?.find((g) => g.id === selectedId);

  const add = (addItem: typeof addOwnedTrait) => {
    const id = randomUUID();
    setEntity((prev) => (prev ? addItem(prev, id) : prev));
    setSelectedId(id);
  };

  return (
    <TraitStoreContext.Provider value={store}>
      <ListDetail
        showDetail={!!trait || !!group}
        onBack={() => setSelectedId(null)}
        backLabel="Traits"
        list={
          <div className="space-y-2 p-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => add(addOwnedTrait)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />Add Trait
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => add(addOwnedGroup)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />Add Group
              </Button>
            </div>
            {/* The tree's own empty hint names the World Editor's + button, which this tab doesn't have. */}
            {entity.traits?.length || entity.traitGroups?.length
              ? <TraitTree selectedId={selectedId} onSelect={setSelectedId} />
              : <Hint className="p-2">No traits yet. Add one to describe this entity to the AI.</Hint>}
          </div>
        }
        detail={
          <div className="p-4">
            {group ? (
              <GroupManager key={group.id} group={group} ownerId={entity.id} />
            ) : trait ? (
              <TraitManager
                key={trait.id}
                trait={trait}
                owner={entity}
                onOpenTrait={setSelectedId}
                onOpenEntity={onOpenEntity}
                tab={tab}
                onTabChange={setTab}
              />
            ) : (
              <p className="text-helper text-muted-foreground">Select a trait to edit it, or add one</p>
            )}
          </div>
        }
      />
    </TraitStoreContext.Provider>
  );
};

export default LibraryTraitsEditor;
