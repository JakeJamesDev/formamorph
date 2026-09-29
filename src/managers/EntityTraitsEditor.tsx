import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Copy, FilePlus, FolderPlus, Link2, X } from 'lucide-react';
import { ListEditor, type ListEditorLayout } from '@/components/ListEditor';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { ListDetailFirstRow } from '@/components/ui/list-detail';
import { TraitStoreContext, type EntityRoot, type TraitStore } from '@/contexts/TraitStoreContext';
import { addOwnedGroup, addOwnedTrait } from '@/lib/ownedTraits';
import { labelPlaceholders } from '@/lib/placementLetters';
import { SELF_ENTITY } from '@/lib/portableTraits';
import { removeLink } from '@/lib/traitLinks';
import { duplicateTraitNode, entityRootTraitTree, linkRowRemovable, type LinkRow } from '@/lib/traitTree';
import { randomUUID } from '@/lib/uuid';
import type { TraitRequirement } from '@/types';
import type { TraitPanelTab } from '@/views/traitPanelTabs';
import GroupManager from './GroupManager';
import { LinkedFromLine, LinkedTraitManager, LinkFooter, LinkNotice, ThisLinkSection } from './TraitLinkPanel';
import TraitManager from './TraitManager';
import TraitTree from './TraitTree';

/** A trait store whose root is one entity: what this editor edits. */
export type EntityTraitStore = TraitStore & { entityRoot: EntityRoot };

/**
 * One entity's traits on the List Editor: the Traits tab's tree over the entity's own items, and the trait,
 * group or Link panel beside or over the list. The caller holds the selection. While a search is typed the
 * list is flat: matching traits and Links, never groups.
 */
const EntityTraitsEditor = ({ store, layout, selectedId, onSelect, onOpenEntity, ownerLine = true, emptyHint, detailHeader }: {
  store: EntityTraitStore;
  layout: ListEditorLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenEntity?: (id: string) => void;
  /** Off, a trait's Details drop their "Owned by" line: for a host whose heading already names the entity. */
  ownerLine?: boolean;
  /** What the list shows while the entity has no traits, groups or Links. */
  emptyHint: ReactNode;
  /** Tops the detail pane: a host's placeholder palette. */
  detailHeader?: ReactNode;
}) => {
  const { bearer, world } = store.entityRoot;
  const { placeholders, traits, traitGroups } = store;
  const [tab, setTab] = useState<TraitPanelTab>('details');
  const resetTab = useCallback(() => setTab('details'), []);

  const tree = useMemo(() => entityRootTraitTree(bearer, world), [bearer, world]);
  const trait = traits.find((t) => t.id === selectedId);
  const group = traitGroups.find((g) => g.id === selectedId);
  const linkRow = selectedId ? tree.linkRows.get(selectedId) : undefined;
  const linkedTrait = linkRow && world?.traits.find((t) => t.id === linkRow.originalId);
  const linkedGroup = linkRow && world?.traitGroups.find((g) => g.id === linkRow.originalId);
  const entityName = labelPlaceholders(bearer.name, placeholders);

  // The row that shows a trait or group id here: its own row, or the row of the Link that reads it. Null when
  // the entity doesn't hold it, so a target outside the entity has nowhere to open.
  const ownsItem = (id: string) => traits.some((t) => t.id === id) || traitGroups.some((g) => g.id === id);
  const rowOf = (id: string): string | null => {
    if (ownsItem(id)) return id;
    const link = [...tree.linkRows.values()].find((row) => row.root && row.originalId === id);
    return link ? link.link.id : null;
  };
  const openHeld = (id: string) => {
    const row = rowOf(id);
    if (row) onSelect(row);
  };
  // "Playing as" the entity itself opens the entity where a host can; every other persona is outside.
  const requirementOpens = (r: TraitRequirement) => (r.kind === 'playingAs'
    ? !!onOpenEntity && (r.id === bearer.id || r.id === SELF_ENTITY)
    : rowOf(r.id) !== null);
  const nameChips = <PlaceholderText text={bearer.name} placeholders={placeholders} />;

  const add = (typed: string, addItem: typeof addOwnedTrait) => {
    const id = randomUUID();
    const next = addItem(bearer, id, typed || undefined);
    store.setTraits(next.traits ?? []);
    store.setTraitGroups(next.traitGroups ?? []);
    onSelect(id);
  };
  const duplicate = (id: string) => {
    const res = duplicateTraitNode(traitGroups, traits, id);
    store.setTraitGroups(res.groups);
    store.setTraits(res.traits);
    onSelect(res.newId);
  };
  const remove = (id: string) => {
    store.removeTrait(id);
    if (id === selectedId) onSelect(null);
  };
  const removeLinkRow = (row: LinkRow) => {
    store.editEntity(row.entityId, (e) => removeLink(e, row.link.id));
    if (row.link.id === selectedId) onSelect(null);
  };

  const rows = (): ListEditorRow[] => {
    // A Link's row carries the name the tree shows for it: the Original's, or the stored one with no Original.
    const rowName = (id: string) => tree.traits.find((t) => t.id === id)?.name ?? tree.groups.find((g) => g.id === id)?.name ?? '';
    return [
      ...traits.map((t): ListEditorRow => ({
        id: t.id,
        name: t.name,
        actions: [
          { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(t.id) },
          { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => remove(t.id) },
        ],
      })),
      ...[...tree.linkRows.values()].filter((row) => row.root).map((row): ListEditorRow => ({
        id: row.link.id,
        name: rowName(row.link.id),
        icon: <Link2 className="h-4 w-4 shrink-0" aria-label="Link" />,
        labelClass: row.unbound ? 'text-muted-foreground' : undefined,
        actions: linkRowRemovable(row, world) ? [{ icon: <X className="h-4 w-4" />, title: 'Remove Link', onClick: () => removeLinkRow(row) }] : [],
      })),
    ];
  };

  const detail = (id: string | null) => (
    <div className="p-4">
      {linkRow ? (
        linkRow.unbound ? (
          <ListDetailFirstRow align="center">
            <LinkNotice>
              Linked to <strong><PlaceholderText text={linkRow.link.originalName} placeholders={placeholders} /></strong>.{' '}
              {world ? "This world doesn't have it." : 'Open this entity from a world to edit the link.'}
            </LinkNotice>
          </ListDetailFirstRow>
        ) : (
          <div key={id}>
            {linkedTrait ? (
              <LinkedTraitManager
                bearer={bearer}
                link={linkRow.link}
                original={linkedTrait}
                onOpenTrait={openHeld}
                onOpenEntity={onOpenEntity}
                requirementOpens={requirementOpens}
                tab={tab}
                onTabChange={setTab}
              />
            ) : linkedGroup && (
              <GroupManager
                group={linkedGroup}
                readOnly
                detailsHeader={<LinkedFromLine originalId={linkRow.originalId} />}
                detailsFooter={<ThisLinkSection entity={bearer} link={linkRow.link} originalId={linkRow.originalId} />}
              />
            )}
          </div>
        )
      ) : group ? (
        <GroupManager key={group.id} group={group} ownerId={bearer.id} />
      ) : trait ? (
        <TraitManager
          key={trait.id}
          trait={trait}
          owner={bearer}
          ownerLine={ownerLine}
          onOpenTrait={openHeld}
          onOpenEntity={onOpenEntity}
          requirementOpens={requirementOpens}
          tab={tab}
          onTabChange={setTab}
        />
      ) : (
        <p className="text-helper text-muted-foreground">Select a trait to edit it, or add one</p>
      )}
    </div>
  );

  const adapter: ListEditorAdapter = {
    tree: <TraitTree selectedId={selectedId} onSelect={onSelect} />,
    rows,
    names: { placeholders },
    noun: 'traits',
    detail,
    footer: () => (linkRow && !linkRow.unbound ? <LinkFooter bearer={bearer} row={linkRow} /> : undefined),
    add: {
      label: `Add to ${entityName}`,
      menuClassName: 'w-56',
      menu: (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label={<>Add Group to {nameChips}</>} onAdd={(typed) => add(typed, addOwnedGroup)} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label={<>Add Trait to {nameChips}</>} onAdd={(typed) => add(typed, addOwnedTrait)} />
        </>
      ),
    },
    placeholder: 'Search or add new traits',
    holds: (id) => ownsItem(id) || tree.linkRows.has(id),
    isEmpty: !(traits.length || traitGroups.length || bearer.traitLinks?.length),
    emptyHint,
    onDropStale: resetTab,
  };

  return (
    <TraitStoreContext.Provider value={store}>
      <ListEditor adapter={adapter} layout={layout} selectedId={selectedId} onSelect={onSelect} backLabel="Traits" detailHeader={detailHeader} />
    </TraitStoreContext.Provider>
  );
};

export default EntityTraitsEditor;
