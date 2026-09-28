import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, FilePlus, FolderPlus, Link2, X } from 'lucide-react';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { ListMenuRow, ListSearchToolbar } from '@/components/ListToolbar';
import { useListSearch } from '@/components/listToolbarHooks';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { ListDetail } from '@/components/ui/list-detail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TraitStoreContext, type EntityRoot, type TraitStore } from '@/contexts/TraitStoreContext';
import { matchesListSearch } from '@/lib/listSearch';
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

/** Side by side splits the pane into list and details; stacked pushes the details over the list. */
export type EntityTraitsLayout = 'sideBySide' | 'stacked';

/** One row of the flat search list: an owned trait, or a Link by the name its row shows. */
type SearchRow = { id: string; name: string; linkRow?: LinkRow };

/**
 * One entity's traits: the Traits tab's tree over the entity's own items, the list toolbar above it, and
 * the trait, group or Link panel beside or over the list. The caller holds the selection; this clears one
 * the entity doesn't hold, so one entity's trait never shows under another's name. While a search is typed
 * the list is flat: matching traits and Links, never groups.
 */
const EntityTraitsEditor = ({ store, layout, selectedId, onSelect, onOpenEntity, ownerLine = true, emptyHint }: {
  store: EntityTraitStore;
  layout: EntityTraitsLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenEntity?: (id: string) => void;
  /** Off, a trait's Details drop their "Owned by" line: for a host whose heading already names the entity. */
  ownerLine?: boolean;
  /** What the list shows while the entity has no traits, groups or Links. */
  emptyHint: ReactNode;
}) => {
  const { bearer, world } = store.entityRoot;
  const { placeholders, traits, traitGroups } = store;
  const search = useListSearch();
  const [tab, setTab] = useState<TraitPanelTab>('details');

  const tree = useMemo(() => entityRootTraitTree(bearer, world), [bearer, world]);
  const trait = traits.find((t) => t.id === selectedId);
  const group = traitGroups.find((g) => g.id === selectedId);
  const linkRow = selectedId ? tree.linkRows.get(selectedId) : undefined;
  const linkedTrait = linkRow && world?.traits.find((t) => t.id === linkRow.originalId);
  const linkedGroup = linkRow && world?.traitGroups.find((g) => g.id === linkRow.originalId);
  const entityName = labelPlaceholders(bearer.name, placeholders);

  // The row that shows a trait or group id here: its own row, or the row of the Link that reads it. Null when
  // the entity doesn't hold it, so a target outside the entity has nowhere to open.
  const rowOf = (id: string): string | null => {
    if (traits.some((t) => t.id === id) || traitGroups.some((g) => g.id === id)) return id;
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

  // A selection this entity doesn't hold is another entity's, or a removed item: drop it, on mount included,
  // since a host that keys the editor by entity remounts it with the old selection still in hand.
  const stale = !!selectedId && !trait && !group && !linkRow;
  useEffect(() => {
    if (!stale) return;
    onSelect(null);
    setTab('details');
  }, [stale, onSelect]);

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

  // A Link's row carries the name the tree shows for it: the Original's, or the stored one with no Original.
  const matches = useMemo((): SearchRow[] | null => {
    if (!search.typed) return null;
    const names = { placeholders };
    const hit = (name: string) => matchesListSearch(name, search.term, names);
    const rowName = (id: string) => tree.traits.find((t) => t.id === id)?.name ?? tree.groups.find((g) => g.id === id)?.name ?? '';
    return [
      ...traits.filter((t) => hit(t.name)).map((t) => ({ id: t.id, name: t.name })),
      ...[...tree.linkRows.values()].filter((row) => row.root)
        .map((row) => ({ id: row.link.id, name: rowName(row.link.id), linkRow: row }))
        .filter((row) => hit(row.name)),
    ];
  }, [search.typed, search.term, placeholders, traits, tree]);

  const searchList = (rows: SearchRow[]) => {
    if (!rows.length) return <p className="text-helper text-muted-foreground p-2">No traits match &ldquo;{search.typed}&rdquo;.</p>;
    return (
      <EditorRowList>
        {rows.map((row) => (
          <EditorRow
            key={row.id}
            grip={false}
            selected={selectedId === row.id}
            onSelect={() => onSelect(row.id)}
            selectionLabel={`Select ${labelPlaceholders(row.name, placeholders)}`}
            icon={row.linkRow && <Link2 className="h-4 w-4 shrink-0" aria-label="Link" />}
            label={<PlaceholderText text={row.name} placeholders={placeholders} />}
            labelClass={row.linkRow?.unbound ? 'text-muted-foreground' : undefined}
            actions={row.linkRow
              ? (linkRowRemovable(row.linkRow, world) ? [{ icon: <X className="h-4 w-4" />, title: 'Remove Link', onClick: () => removeLinkRow(row.linkRow!) }] : [])
              : [
                { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(row.id) },
                { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => remove(row.id) },
              ]}
          />
        ))}
      </EditorRowList>
    );
  };

  const hasItems = !!(traits.length || traitGroups.length || bearer.traitLinks?.length);

  return (
    <TraitStoreContext.Provider value={store}>
      <ListDetail
        stacked={layout === 'stacked'}
        showDetail={!!trait || !!group || !!linkRow}
        onBack={() => onSelect(null)}
        backLabel="Traits"
        scrollList={false}
        detailFooter={linkRow && !linkRow.unbound ? <LinkFooter bearer={bearer} row={linkRow} /> : undefined}
        list={
          <div className="flex h-full min-h-0 flex-col">
            <ListSearchToolbar
              className="p-2 pb-0"
              search={search}
              placeholder="Search or add new traits"
              add={{
                label: `Add to ${entityName}`,
                menuClassName: 'w-56',
                menu: (
                  <>
                    <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label={<>Add Group to {nameChips}</>} onAdd={(typed) => add(typed, addOwnedGroup)} />
                    <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label={<>Add Trait to {nameChips}</>} onAdd={(typed) => add(typed, addOwnedTrait)} />
                  </>
                ),
              }}
            />
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">
                {matches ? searchList(matches)
                  : hasItems ? <TraitTree selectedId={selectedId} onSelect={onSelect} />
                  : emptyHint}
              </div>
            </ScrollArea>
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
                <div key={selectedId}>
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
        }
      />
    </TraitStoreContext.Provider>
  );
};

export default EntityTraitsEditor;
