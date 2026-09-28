import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListDetail } from '@/components/ui/list-detail';
import { Hint } from '@/components/ui/typography';
import { TraitStoreContext, type LibraryLinks, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import {
  addOwnedGroup, addOwnedTrait, removeOwnedItem, updateOwnedGroup, updateOwnedTrait, withOwnedTraits,
} from '@/lib/ownedTraits';
import { bindOwnedTraits, linksBoundTo, linksCarriedFrom, type TraitWorld } from '@/lib/portableTraits';
import { libraryTraitTree } from '@/lib/traitTree';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { randomUUID } from '@/lib/uuid';
import type { TraitPanelTab } from '@/views/traitPanelTabs';
import type { Entity, Placeholder } from '@/types';
import TraitTree from './TraitTree';
import TraitManager from './TraitManager';
import GroupManager from './GroupManager';
import { LinkedFromLine, LinkNotice, ThisLinkSection } from './TraitLinkPanel';

const NO_WORLD: TraitWorld = { traits: [], traitGroups: [], entities: [] };

/** The world a library entity's editor was opened from: what its links and requirements read. */
export type LibraryEditorWorld = TraitWorld & { placeholders: readonly Placeholder[] };

/**
 * A trait store over one library entity: its own traits fill the tree's root, and every write lands on it.
 * Inside `world`, its links read their originals there, and a link edit stores them named from it.
 */
function libraryTraitStore(
  entity: Entity, setEntity: Dispatch<SetStateAction<Entity | null>>, placeholders: Placeholder[], world: LibraryEditorWorld | null,
): TraitStore & { library: LibraryLinks } {
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
    editEntity: (id, change) => edit((e) => {
      if (e.id !== id) return e;
      return world ? linksCarriedFrom(change(linksBoundTo(e, world)), world) : change(e);
    }),
    // Standalone, "playing as" itself resolves and an outward requirement reads by its stored name.
    gateInput: editorGateInput({
      traits: world?.traits ?? [], traitGroups: world?.traitGroups ?? [],
      entities: [...(world?.entities ?? []).filter((e) => e.id !== entity.id), bindOwnedTraits(entity, world ?? NO_WORLD)],
    }),
    pinWorld: null,
    offWorld: true,
    library: { bearer: world ? linksBoundTo(entity, world) : entity, world },
  };
}

/**
 * A library entity's Traits tab: the World Editor's tree and trait panel over the entity's own traits.
 * Requirements can point only inside the entity; one that points out of it reads by its stored name. Opened
 * inside `world`, a link shows its This Link section, and detaches or removes from its row; standalone, and
 * when the world has no such original, it reads by its stored name only. No link is made here.
 */
const LibraryTraitsEditor = ({ entity, setEntity, placeholders, onOpenEntity, world = null }: {
  entity: Entity;
  setEntity: Dispatch<SetStateAction<Entity | null>>;
  placeholders: Placeholder[];
  onOpenEntity: () => void;
  world?: LibraryEditorWorld | null;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TraitPanelTab>('details');
  const store = useMemo(() => libraryTraitStore(entity, setEntity, placeholders, world), [entity, setEntity, placeholders, world]);
  const trait = entity.traits?.find((t) => t.id === selectedId);
  const group = entity.traitGroups?.find((g) => g.id === selectedId);
  const linkRow = useMemo(
    () => (selectedId ? libraryTraitTree(store.library.bearer, store.library.world).linkRows.get(selectedId) : undefined),
    [selectedId, store],
  );

  const add = (addItem: typeof addOwnedTrait) => {
    const id = randomUUID();
    setEntity((prev) => (prev ? addItem(prev, id) : prev));
    setSelectedId(id);
  };

  return (
    <TraitStoreContext.Provider value={store}>
      <ListDetail
        showDetail={!!trait || !!group || !!linkRow}
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
            {entity.traits?.length || entity.traitGroups?.length || entity.traitLinks?.length
              ? <TraitTree selectedId={selectedId} onSelect={setSelectedId} />
              : <Hint className="p-2">No traits yet. Add one to describe this entity to the AI.</Hint>}
          </div>
        }
        detail={
          <div className="p-4">
            {linkRow ? (
              linkRow.unbound ? (
                <LinkNotice>
                  Linked to <strong><PlaceholderText text={linkRow.link.originalName} placeholders={placeholders} /></strong>.{' '}
                  {world ? "This world doesn't have it." : 'Open this entity from a world to edit the link.'}
                </LinkNotice>
              ) : (
                <div key={selectedId} className="space-y-4">
                  <LinkedFromLine originalId={linkRow.originalId} />
                  <ThisLinkSection entity={store.library.bearer} link={linkRow.link} originalId={linkRow.originalId} />
                </div>
              )
            ) : group ? (
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
