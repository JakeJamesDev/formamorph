import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Hint } from '@/components/ui/typography';
import type { EntityRoot, TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import { ownedTraitWrites } from '@/lib/ownedTraits';
import { bindOwnedTraits, linksBoundTo, linksCarriedFrom, type TraitWorld } from '@/lib/portableTraits';
import type { Entity, Placeholder } from '@/types';
import EntityTraitsEditor, { type EntityTraitStore } from './EntityTraitsEditor';

const NO_WORLD: TraitWorld = { traits: [], traitGroups: [], entities: [] };

/** The world a library entity's editor was opened from: what its links and requirements read. */
export type LibraryEditorWorld = TraitWorld & { placeholders: readonly Placeholder[] };

/**
 * A trait store over one library entity: its own traits fill the tree's root, and every write lands on it.
 * Inside `world`, its links read their originals there, and a link edit stores them named from it. It is
 * off world: requirements point only inside the entity, and the pin rows have no rivals to read.
 */
function libraryTraitStore(
  entity: Entity, setEntity: Dispatch<SetStateAction<Entity | null>>, placeholders: Placeholder[], world: LibraryEditorWorld | null,
): EntityTraitStore {
  const edit = (change: (e: Entity) => Entity) => setEntity((prev) => (prev ? change(prev) : prev));
  const traits = entity.traits ?? [];
  const traitGroups = entity.traitGroups ?? [];
  const entityRoot: EntityRoot = { bearer: world ? linksBoundTo(entity, world) : entity, world };
  const store: TraitStore = {
    traits,
    traitGroups,
    entities: [],
    placeholders,
    stats: [],
    ...ownedTraitWrites(edit),
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
  };
  return { ...store, entityRoot };
}

/**
 * A library entity's Traits tab: the shared entity traits editor, side by side, over the entity's own traits.
 * Requirements can point only inside the entity; one that points out of it reads by its stored name. Opened
 * inside `world`, a link shows its This Link section, and detaches or removes from its row; standalone, and
 * when the world has no such original, it reads by its stored name only. No link is made here. The tab
 * unmounts on a tab switch, so its selection starts over each time it opens.
 */
const LibraryTraitsEditor = ({ entity, setEntity, placeholders, onOpenEntity, world = null, detailHeader }: {
  entity: Entity;
  setEntity: Dispatch<SetStateAction<Entity | null>>;
  placeholders: Placeholder[];
  onOpenEntity: () => void;
  world?: LibraryEditorWorld | null;
  detailHeader?: ReactNode;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const store = useMemo(() => libraryTraitStore(entity, setEntity, placeholders, world), [entity, setEntity, placeholders, world]);
  return (
    <EntityTraitsEditor
      store={store}
      layout="sideBySide"
      selectedId={selectedId}
      onSelect={setSelectedId}
      onOpenEntity={onOpenEntity}
      emptyHint={<Hint className="p-2">No traits yet. Add one to describe this entity to the AI.</Hint>}
      detailHeader={detailHeader}
    />
  );
};

export default LibraryTraitsEditor;
