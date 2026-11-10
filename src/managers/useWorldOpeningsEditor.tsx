import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, MapPinOff, Plus } from 'lucide-react';
import { EditorRow, EditorRowList, treeRowPaddingLeft } from '@/components/EditorRow';
import { ListSearchToolbar } from '@/components/ListToolbar';
import type { ListEditorParts } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { CollapseAllButton } from '@/components/CollapseAllButton';
import { Button } from '@/components/ui/button';
import { ListDetailBack } from '@/components/ui/list-detail';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { EntityIcon, GroupIcon, LocationIcon, WorldIcon } from '@/lib/elementIcons';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import {
  addOpening, hasAuthoredOpenings, openingsEditorView, type EditorOpeningRow, type OpeningOwner,
} from '@/lib/openings';
import {
  entityOwnerKey, entityPickChoices, foldKey, locationOwnerKey, locationPicker, openingsTabOwners, openingsTabRows,
  resolveOwnerKey, WORLD_OWNER_KEY, type OpeningsTabOwner, type OwnerKind,
} from '@/lib/openingsTab';
import { labelPlaceholders } from '@/lib/placementLetters';
import { cn } from '@/lib/utils';
import {
  DefaultOpeningNote, EntityOpeningsHint, LocationOpeningsHint, OpeningsList, WorldOpeningsHint,
} from './OpeningsPanel';
import { OpeningsAddMenu } from './OpeningsAddMenu';

const NONE_COLLAPSED: ReadonlySet<string> = new Set();

const KIND_ICON = { world: WorldIcon, location: LocationIcon, entity: EntityIcon } as const;

const NO_START_TIP: Record<Exclude<OwnerKind, 'world'>, string> = {
  location: "Isn't a starting location, so its openings never come up",
  entity: "Isn't at any starting location, so its openings never come up",
};

/**
 * The World Editor's Openings tab: This World and every location and entity with openings, in their own
 * nesting, beside the selected owner's openings. With nothing selected, desktop shows This World. A search
 * keeps an owner whose name or opening text matches, and a parent folds its rows away until a search is typed.
 * Neither moves the selection.
 */
export function useWorldOpeningsEditor({ selectedId, onSelect, search, defaultToWorld, onOpenEntity, onOpenLocation }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: ListSearch;
  /** Holds This World while nothing is selected: the desktop split always has a pane to fill. */
  defaultToWorld: boolean;
  /** Opens that entity's Openings tab. */
  onOpenEntity: (entityId: string) => void;
  /** Opens that location's Openings tab. */
  onOpenLocation: (locationId: string) => void;
}): ListEditorParts {
  const {
    worldOverview, updateWorldOverview, entities, entityGroups, updateEntity, locations, updateLocation, placeholders,
    placementLetters, placeholderOwners,
  } = useGameData();
  // Folded rows last while the editor is open, like the selection.
  const [folded, setFolded] = useState<ReadonlySet<string>>(NONE_COLLAPSED);
  const view = openingsEditorView({ overview: worldOverview, entities, locations });
  const names: ListSearchNames = { placeholders, letters: placementLetters, owners: placeholderOwners };
  const label = (name: string) => labelPlaceholders(name, placeholders, { letters: placementLetters, owners: placeholderOwners });
  const typed = search.typed;
  const textMatches = (rows: EditorOpeningRow[]) => rows.some((row) => matchesListSearch(row.opening.text, typed, names));
  const matches = (name: string, rows: EditorOpeningRow[]) => !typed || matchesListSearch(name, typed, names) || textMatches(rows);

  // A key no owner answers to any more (a deleted location or entity) falls back to This World.
  const resolved = selectedId ? resolveOwnerKey(selectedId, locations, entities) : null;
  const ownerGone = !!selectedId && !resolved;
  useEffect(() => { if (ownerGone) onSelect(WORLD_OWNER_KEY); }, [ownerGone, onSelect]);

  const heldKey = resolved && selectedId ? selectedId : defaultToWorld || ownerGone ? WORLD_OWNER_KEY : null;
  const owners = openingsTabOwners(view, resolved && selectedId ? { key: selectedId, owner: resolved } : null);
  // A search shows every match, so it ignores the folds.
  const collapsed = typed ? NONE_COLLAPSED : folded;
  const rowsArgs = { owners, locations, entities, entityGroups, matches };
  const rows = openingsTabRows({ ...rowsArgs, collapsed });
  // Collapse All acts on every parent, whatever the search shows.
  const parentKeys = openingsTabRows({ ...rowsArgs, matches: () => true, collapsed: NONE_COLLAPSED })
    .flatMap((row) => (row.kind !== 'rule' && row.parent ? [foldKey(row)] : []));
  const anyOpen = parentKeys.some((key) => !folded.has(key));
  const toggleAll = () => setFolded(anyOpen ? new Set(parentKeys) : NONE_COLLAPSED);
  const toggleFold = (key: string) => setFolded((was) => {
    const next = new Set(was);
    if (!next.delete(key)) next.add(key);
    return next;
  });
  const held = heldKey ? owners.get(heldKey) : undefined;

  const displayName = (owner: OpeningsTabOwner) => (owner.kind === 'world'
    ? 'This World'
    : label(owner.name) || (owner.kind === 'location' ? 'Unnamed Location' : 'Unnamed Entity'));

  const noStartIcon = (kind: OwnerKind, className?: string) => kind !== 'world' && (
    <span role="img" aria-label="No Starting Location" className={cn('inline-flex shrink-0', className)}>
      <MapPinOff className="h-3.5 w-3.5" aria-hidden />
    </span>
  );

  const lead = (parent: boolean) => (parent ? 'chevron' : parentKeys.length ? 'spacer' : undefined);

  const ownerRow = (owner: OpeningsTabOwner, depth: number, parent = false, isCollapsed = false) => {
    const Icon = KIND_ICON[owner.kind];
    const count = owner.group.rows.length;
    const name = displayName(owner);
    return (
      <EditorRow
        key={owner.key}
        grip={false}
        depth={depth}
        lead={lead(parent)}
        collapsed={isCollapsed}
        onToggleCollapse={() => toggleFold(owner.key)}
        collapseLabels={[`Expand ${name}`, `Collapse ${name}`]}
        selected={heldKey === owner.key}
        onSelect={() => onSelect(owner.key)}
        selectionLabel={`Select ${name}`}
        icon={<Icon className="h-4 w-4 shrink-0" aria-hidden />}
        label={name}
        meta={(
          <span className="flex items-center gap-1.5">
            {owner.group.atNoStart && noStartIcon(owner.kind)}
            <span className="tabular-nums">{count}</span>
          </span>
        )}
        metaTitle={`${count} ${count === 1 ? 'opening' : 'openings'}${owner.group.atNoStart ? ', No Starting Location' : ''}`}
        actions={[]}
      />
    );
  };

  const [worldRow, ...ownedRows] = rows;
  const anyOwned = ownedRows.length > 0;
  const list = (
    <div>
      <EditorRowList className={cn(anyOwned && 'mb-1 border-b pb-1')}>
        {worldRow?.kind === 'owner' && ownerRow(worldRow.owner, 0)}
      </EditorRowList>
      {anyOwned && (
        <EditorRowList>
          {ownedRows.map((row) => {
            if (row.kind === 'owner') return ownerRow(row.owner, row.depth, row.parent, row.collapsed);
            if (row.kind === 'rule') return <div key={row.key} role="separator" className="my-1 border-b" />;
            const Icon = row.context === 'location' ? LocationIcon : GroupIcon;
            const name = label(row.name) || (row.context === 'location' ? 'Unnamed Location' : 'Unnamed Folder');
            return (
              // Context only: a parent that holds no listed owner. It never selects, but it folds.
              <div
                key={row.key}
                data-testid="openings-context-row"
                className="flex items-center gap-1 px-2 py-1 text-label text-muted-foreground"
                style={{ paddingLeft: treeRowPaddingLeft(row.depth) }}
              >
                {row.parent ? (
                  <button
                    type="button"
                    className="shrink-0"
                    aria-label={row.collapsed ? `Expand ${name}` : `Collapse ${name}`}
                    onClick={(e) => { e.stopPropagation(); toggleFold(row.key); }}
                  >
                    {row.collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                  </button>
                ) : <span className="w-4 shrink-0" aria-hidden />}
                <span className="w-6 shrink-0" aria-hidden />
                <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                <span className="min-w-0 truncate opacity-70">{name}</span>
              </div>
            );
          })}
        </EditorRowList>
      )}
      {typed && !anyOwned && <Hint className="p-2">Nothing else matches &ldquo;{typed}&rdquo;</Hint>}
    </div>
  );

  const patchOwner = (owner: OpeningsTabOwner, patch: OpeningOwner) => {
    const { location, entity } = owner.group;
    if (owner.kind === 'world') updateWorldOverview(patch);
    else if (location) updateLocation({ ...location, ...patch });
    else if (entity) updateEntity({ ...entity, ...patch });
  };
  const ownerOf = (owner: OpeningsTabOwner): OpeningOwner =>
    owner.kind === 'world' ? worldOverview : owner.group.location ?? owner.group.entity ?? {};

  const ownersOfOpenings = [...entities, ...locations];
  const detail = held ? (
    <OwnerPane
      owner={held}
      name={displayName(held)}
      onOpen={() => {
        if (held.group.location) onOpenLocation(held.group.location.id);
        else if (held.group.entity) onOpenEntity(held.group.entity.id);
      }}
      onAdd={() => patchOwner(held, addOpening(ownerOf(held)))}
      noStart={held.group.atNoStart && held.kind !== 'world' ? NO_START_TIP[held.kind] : null}
    >
      {held.kind === 'world' && view.defaultOpening && !typed && <DefaultOpeningNote view={view} label={label} />}
      <OpeningsList
        owner={ownerOf(held)}
        rows={held.group.rows}
        onChange={(patch) => patchOwner(held, patch)}
        placeholders={placeholders}
        ownerId={held.group.entity?.id}
        ownerName={held.group.entity?.name}
        search={typed}
        names={names}
        addButton={false}
        selfSwitch={held.group.showSelf}
        empty={held.kind === 'world' && view.defaultOpening ? null : <Hint>No openings yet</Hint>}
      />
      {held.kind === 'world'
        ? <WorldOpeningsHint anyOpenings={[worldOverview, ...ownersOfOpenings].some(hasAuthoredOpenings)} />
        : held.group.location
          ? <LocationOpeningsHint />
          : held.group.entity && <EntityOpeningsHint worldOwner={held.group.entity} showSelf={held.group.showSelf} />}
    </OwnerPane>
  ) : null;

  // The + offers what the tab doesn't list with no search (Q7, Q21).
  const listedKeys = new Set(openingsTabOwners(view, null).keys());
  const addMenu = (
    <OpeningsAddMenu
      locations={locationPicker(locations, (id) => listedKeys.has(locationOwnerKey(id)))}
      entityChoices={entityPickChoices(entityGroups, entities, (id) => listedKeys.has(entityOwnerKey(id)))}
      onPickLocation={(l) => { updateLocation({ ...l, ...addOpening(l) }); onSelect(locationOwnerKey(l.id)); }}
      onPickEntity={(id) => {
        const entity = entities.find((e) => e.id === id);
        if (!entity) return;
        updateEntity({ ...entity, ...addOpening(entity) });
        onSelect(entityOwnerKey(id));
      }}
    />
  );

  return {
    search,
    toolbar: (className, extras) => (
      <ListSearchToolbar
        className={className}
        search={search}
        placeholder="Search openings"
        add={{ label: 'Add to Openings', menu: addMenu }}
        after={(
          <>
            {parentKeys.length > 0 && <CollapseAllButton anyOpen={anyOpen} noun="groups" onClick={toggleAll} />}
            {extras?.after}
          </>
        )}
        target={extras?.target}
      >
        {extras?.children}
      </ListSearchToolbar>
    ),
    list,
    detail,
    footer: undefined,
    fills: false,
    ownsSlot: false,
    showDetail: !!held,
    onBack: () => onSelect(null),
  };
}

/** The selected owner's header (icon, name, Add Opening), its notes, and its openings. */
function OwnerPane({ owner, name, onOpen, onAdd, noStart, children }: {
  owner: OpeningsTabOwner;
  name: string;
  /** Opens the owner's own Openings tab. This World has none. */
  onOpen: () => void;
  onAdd: () => void;
  /** Why the owner's openings never come up, when they don't. */
  noStart: string | null;
  children: ReactNode;
}) {
  const Icon = KIND_ICON[owner.kind];
  return (
    <section aria-label={name} className="space-y-3">
      <div className="flex items-center gap-2">
        <ListDetailBack />
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-body font-semibold">
          {owner.kind === 'world' ? name : (
            <Tip tip={owner.kind === 'location' ? "Open this location's Openings tab" : "Open this entity's Openings tab"} labelsChild={false}>
              <Button type="button" variant="link" className="h-auto max-w-full p-0 text-body font-semibold" onClick={onOpen}>
                <span className="truncate">{name}</span>
              </Button>
            </Tip>
          )}
        </h2>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" aria-hidden /> Add Opening
        </Button>
      </div>
      {noStart && (
        <Hint className="flex items-center gap-1">
          <MapPinOff className="h-3.5 w-3.5 shrink-0" aria-hidden /> {noStart}
        </Hint>
      )}
      {children}
    </section>
  );
}
